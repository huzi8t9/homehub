# devices/discovery.py
"""
Discovery loop that classifies devices and upserts Device rows.
"""
import logging
import threading
from django.utils import timezone
from django.db import transaction
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from .models import Device
from .net_scan import scan_subnet_once

logger = logging.getLogger(__name__)
DEFAULT_DISCOVERY_INTERVAL = 60  # seconds
MIN_INTERVAL = 5

TI_MAC_PREFIXES = ["9C:76:13", "70:FF:76", "C8:DF:84"]

def _emit(payload: dict):
    layer = get_channel_layer()
    if not layer:
        return
    try:
        async_to_sync(layer.group_send)("devices", {"type": "device.event", "payload": payload})
    except RuntimeError:
        # Happens during interpreter shutdown; safe to ignore.
        logger.debug("Channel layer unavailable during shutdown; event dropped", exc_info=True)

def classify_and_caps(raw: dict):
    """
    Turn a raw scan dict into (device_type, capabilities, vendor, display_name).
    raw has keys: ip, hostname, open_ports, http{server,title}, yeelight?, mac?, ...
    """
    ports = set(raw.get("open_ports", []))
    host = (raw.get("hostname") or "").lower()
    http = raw.get("http") or {}
    server = (http.get("server") or "").lower()

    # Yeelight LAN
    if 55443 in ports and raw.get("yeelight"):
        name = raw["yeelight"].get("name") or raw.get("hostname") or ""
        return ("light.yeelight", ["on_off", "brightness"], "yeelight", name, None)

    # Google Cast devices
    if 8008 in ports or 8009 in ports:
        from pychromecast import get_listed_chromecasts, discovery

        try:
            cast_infos, browser = get_listed_chromecasts(known_hosts=[raw["ip"]])
            try:
                if cast_infos:
                    cast_info = cast_infos[0]
                    vendor = cast_info.manufacturer or "google"
                    name = cast_info.friendly_name or raw.get("hostname") or ""
                    extra_meta = {
                        "cast": {
                            "model": cast_info.model_name,
                            "uuid": str(cast_info.uuid) if cast_info.uuid else None,
                            "cast_type": cast_info.cast_type,
                        }
                    }
                    return ("media.cast", ["launch", "volume"], vendor, name, extra_meta)
                # See if the device is already present in the discovery browser cache
                for key in browser.devices.keys():
                    cast_info = browser.devices[key]
                    if cast_info.host == raw["ip"]:
                        vendor = cast_info.manufacturer or "google"
                        name = cast_info.friendly_name or raw.get("hostname") or ""
                        extra_meta = {
                            "cast": {
                                "model": cast_info.model_name,
                                "uuid": str(cast_info.uuid) if cast_info.uuid else None,
                                "cast_type": cast_info.cast_type,
                            }
                        }
                        return ("media.cast", ["launch", "volume", "cast"], vendor, name, extra_meta)
            finally:
                if browser:
                    discovery.stop_discovery(browser)
        except Exception:
            logger.debug("Chromecast lookup failed for %s", raw.get("ip"), exc_info=True)

    # Sky router / Sky box
    if "sky" in server or "sky" in host or "skyrouter" in host:
        name = raw.get("hostname") or ""
        return ("unknown", [], server or "sky", name, None)

    # Microsoft IIS host
    if "microsoft-iis" in server:
        name = raw.get("hostname") or ""
        return ("unknown", [], "microsoft-iis", name, None)

    # Amazon devices occasionally show as amazon-*. Port 55443 is not a Yeelight indicator here.
    if host.startswith("amazon-"):
        return ("unknown", [], "amazon", raw.get("hostname") or "", None)
    
    mac = (raw.get("mac") or "").upper()
    if mac.startswith(tuple(TI_MAC_PREFIXES)):
        device_type = "sensor.ti"
        vendor = "Texas Instruments"
        name = raw.get("hostname") or ""
        return (device_type, ["sensor"], vendor, name, None)
    
    for parts in host.split(" "):
        if parts.startswith("raspberrypi"):
            return ("computer.raspberrypi", ["ssh", "ping"], "Raspberry Pi Foundation", raw.get("hostname") or "", None)
        # iPhone, iPad, Mac
        if parts.startswith("iphone") or parts.startswith("ipad") or parts.startswith("macbook"):
            return ("computer.apple", ["ping"], "Apple", raw.get("hostname") or "", None)
        

    # Fallback
    vendor = server or ""
    return ("unknown", [], vendor, raw.get("hostname") or "", None)

def upsert_device(raw):
    """
    raw e.g.
    {'ip','hostname','open_ports':[],'http':{},'yeelight':{...}, 'mac': 'xx:..'}
    """
    device_type, caps, vendor, name, metadata = classify_and_caps(raw)
    mac_or_ip = raw.get("mac", "") or raw["ip"]

    # combine raw and metadata
    if metadata:
        raw.update(metadata)

    with transaction.atomic():
        obj, created = Device.objects.update_or_create(
            mac=mac_or_ip,
            defaults=dict(
                name=name,
                ip=raw.get("ip"),
                device_type=device_type,
                capabilities=caps,
                vendor=vendor,
                meta={"raw": raw},
                is_online=True,
                last_seen=timezone.now()
            )
        )
    _emit({"event": "device_created" if created else "device_updated", "device_id": obj.id})

def run_once_and_upsert():
    devices = scan_subnet_once()
    for d in devices:
        upsert_device(d)
    return len(devices)

def discovery_loop(stop_event, interval=DEFAULT_DISCOVERY_INTERVAL):
    logger.info("Device discovery loop running (interval=%ss)", interval)
    while not stop_event.is_set():
        try:
            run_once_and_upsert()
        except Exception:
            logger.exception("Discovery loop iteration failed; continuing")
        # Mark stale offline
        cutoff = timezone.now() - timezone.timedelta(seconds=interval * 5)
        Device.objects.filter(last_seen__lt=cutoff, is_online=True).update(is_online=False)
        stop_event.wait(interval)

_thread_handle = None
_stop = threading.Event()
_lock = threading.Lock()
_current_interval = DEFAULT_DISCOVERY_INTERVAL
_one_off_thread = None
_one_off_lock = threading.Lock()

def start_discovery(interval=None):
    """Start the background discovery thread if it is not already running."""
    global _thread_handle, _stop, _current_interval
    requested_interval = max(MIN_INTERVAL, interval or DEFAULT_DISCOVERY_INTERVAL)
    with _lock:
        if _thread_handle and _thread_handle.is_alive():
            return
        _stop = threading.Event()
        _current_interval = requested_interval
        _thread_handle = threading.Thread(
            target=discovery_loop,
            args=(_stop, requested_interval),
            daemon=True,
            name="device-discovery-loop",
        )
        _thread_handle.start()
        logger.info("Device discovery loop started (interval=%ss)", requested_interval)

def stop_discovery():
    """Signal the discovery loop to stop and wait briefly for the thread to exit."""
    global _thread_handle, _stop
    with _lock:
        if not _thread_handle:
            return
        _stop.set()
        _thread_handle.join(timeout=5)
        _thread_handle = None
        _stop = threading.Event()
        logger.info("Device discovery loop stopped")

def trigger_discovery_run():
    """Kick off a one-off discovery pass in the background.

    Returns True when a new run is started, False if one is already active.
    """
    global _one_off_thread
    with _one_off_lock:
        if _one_off_thread and _one_off_thread.is_alive():
            return False

        def _job():
            try:
                logger.info("One-off discovery pass started")
                run_once_and_upsert()
                logger.info("One-off discovery pass completed")
            except Exception:
                logger.exception("One-off discovery pass failed")

        _one_off_thread = threading.Thread(target=_job, daemon=True, name="device-discovery-once")
        _one_off_thread.start()
        logger.info("One-off discovery pass thread started")
        return True
