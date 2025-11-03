"""
Google Cast / Google Home provider.

Controls Google Home and Chromecast-enabled speakers/displays over the local network.

Dependencies:
  pip install pychromecast gTTS

Expected device.meta:
{
  // Either set ip OR friendly_name
  "ip": "192.168.0.6",
  "friendly_name": "Google-Home-Mini",

  // Optional TTS config (only needed for `say`)
  // The device must be able to fetch the MP3 via HTTP
  "tts_base_url": "http://your-dashboard.local/tts",
  "tts_storage_path": "/var/www/tts"   // this directory must be served at tts_base_url
}

Supported actions:
  set_volume { "level": 0..100 }
  volume_up { "step": 5 }                // default 5
  volume_down { "step": 5 }              // default 5
  mute { "on": true|false }
  play_media { "url": "...", "content_type": "audio/mp3", "stream_type": "BUFFERED" }
  pause {}
  play {}
  stop {}
  say { "text": "Hello there", "lang": "en" }   // requires tts_* meta
  launch_app { "app_id": "YouTube" or exact appId }
  status {}
"""

from .base import BaseProvider, ProviderError
import pychromecast
from pychromecast.controllers.media import STREAM_TYPE_BUFFERED, STREAM_TYPE_LIVE
from gtts import gTTS
import os
import time
import uuid
import zeroconf
from uuid import UUID
from pychromecast import get_listed_chromecasts, discovery
from pychromecast.discovery import CastInfo

STREAM_TYPES = {
    "BUFFERED": STREAM_TYPE_BUFFERED,
    "LIVE": STREAM_TYPE_LIVE
}

def _resolve_cast(meta, device):
    zconf = zeroconf.Zeroconf()
    raw_meta = meta.get("raw") or {}
    cast_meta = meta.get("cast") or raw_meta.get("cast") or {}

    ip = meta.get("ip") or device.ip or raw_meta.get("ip")
    friendly = (
        meta.get("friendly_name")
        or device.name
        or raw_meta.get("hostname")
        or cast_meta.get("friendly_name")
    )

    # 1. If we already know the UUID, build a CastInfo directly.
    uuid_str = cast_meta.get("uuid")
    if uuid_str and ip:
        cast_info = CastInfo(
            services=frozenset(),
            uuid=UUID(uuid_str),
            model_name=cast_meta.get("model") or "",
            friendly_name=friendly or "",
            host=ip,
            port=cast_meta.get("port", 8009),
            cast_type=cast_meta.get("cast_type") or "cast",
            manufacturer=cast_meta.get("manufacturer") or "Google",
        )
        return pychromecast.get_chromecast_from_cast_info(cast_info, zconf=zconf)

    # 2. Otherwise fall back to discovery, but use the cached hints so it’s fast.
    known_hosts = [ip] if ip else None
    friendly_names = [friendly] if friendly else None
    uuids = [UUID(uuid_str)] if uuid_str else None

    cast_infos, browser = get_listed_chromecasts(
        known_hosts=known_hosts,
        friendly_names=friendly_names,
        uuids=uuids,
    )
    try:
        if not cast_infos:
            raise ProviderError("Cast device not found")
        cast = pychromecast.get_chromecast_from_cast_info(
            cast_infos[0], zconf_instance=getattr(browser, "zc", None)
        )
        return cast
    finally:
        if browser:
            discovery.stop_discovery(browser)

class GoogleCastProvider(BaseProvider):
    def command(self, device, action: str, params: dict) -> dict:
        meta = device.meta or {}
        cast = _resolve_cast(meta, device)
        mc = cast.media_controller

        if action == "set_volume":
            level = (params or {}).get("level")
            if level is None:
                raise ProviderError("set_volume requires 'level' 0..100")
            try:
                cast.set_volume(max(0.0, min(1.0, float(level) / 100.0)))
                return {"status": "ok", "volume": int(cast.status.volume_level * 100)}
            except Exception as e:
                raise ProviderError(f"Volume set failed: {e}")

        if action == "volume_up":
            step = int((params or {}).get("step", 5))
            new_level = int(min(100, (cast.status.volume_level or 0) * 100 + step))
            cast.set_volume(new_level / 100.0)
            return {"status": "ok", "volume": new_level}

        if action == "volume_down":
            step = int((params or {}).get("step", 5))
            new_level = int(max(0, (cast.status.volume_level or 0) * 100 - step))
            cast.set_volume(new_level / 100.0)
            return {"status": "ok", "volume": new_level}

        if action == "mute":
            on = bool((params or {}).get("on", True))
            cast.set_volume_muted(on)
            return {"status": "ok", "muted": on}

        if action == "play_media":
            url = (params or {}).get("url")
            if not url:
                raise ProviderError("play_media requires 'url'")
            content_type = (params or {}).get("content_type", "audio/mp3")
            stream_type_key = (params or {}).get("stream_type", "BUFFERED")
            stream_type = STREAM_TYPES.get(stream_type_key, STREAM_TYPE_BUFFERED)
            try:
                mc.play_media(url, content_type, stream_type=stream_type)
                mc.block_until_active(timeout=10)
                return {"status": "playing", "url": url}
            except Exception as e:
                raise ProviderError(f"Failed to start media: {e}")

        if action == "pause":
            mc.pause()
            return {"status": "paused"}

        if action == "play":
            mc.play()
            return {"status": "playing"}

        if action == "stop":
            mc.stop()
            return {"status": "stopped"}

        if action == "say":
            text = (params or {}).get("text")
            if not text:
                raise ProviderError("say requires 'text'")
            tts_base = meta.get("tts_base_url")
            tts_path = meta.get("tts_storage_path")
            if not tts_base or not tts_path:
                raise ProviderError("say requires 'tts_base_url' and 'tts_storage_path' in device.meta")

            lang = (params or {}).get("lang", "en")
            fname = f"cast-tts-{uuid.uuid4().hex}.mp3"
            fpath = os.path.join(tts_path, fname)

            try:
                os.makedirs(tts_path, exist_ok=True)
                gTTS(text=text, lang=lang).save(fpath)
                url = f"{tts_base.rstrip('/')}/{fname}"
                mc.play_media(url, "audio/mp3", stream_type=STREAM_TYPE_BUFFERED)
                mc.block_until_active(timeout=10)
                return {"status": "speaking", "url": url}
            except Exception as e:
                raise ProviderError(f"TTS failed: {e}")

        if action == "launch_app":
            app_id = (params or {}).get("app_id")
            if not app_id:
                raise ProviderError("launch_app requires 'app_id'")
            try:
                cast.start_app(app_id)
                # Give the device a moment to switch apps
                time.sleep(0.5)
                return {"status": "launched", "app_id": app_id}
            except Exception as e:
                raise ProviderError(f"App launch failed: {e}")

        if action == "status":
            try:
                device_status = cast.get_status()
            except Exception:
                device_status = None
            st = device_status or cast.status
            if not st:
                raise ProviderError("Unable to obtain device status")

            try:
                media_state = mc.update_status()
            except Exception:
                media_state = mc.status

            app = cast.app_display_name or ""
            payload = {
                "status": "ok",
                "volume": int((st.volume_level or 0) * 100),
                "muted": st.volume_muted,
                "app_id": cast.app_id,
                "app_name": app,
            }
            media_status = None
            if media_state:
                media_status = {
                    "player_state": media_state.player_state,
                    "content_id": media_state.content_id,
                    "content_type": media_state.content_type,
                    "title": media_state.title,
                    "artist": media_state.artist,
                    "album_name": media_state.album_name,
                    "current_time": media_state.current_time,
                    "duration": media_state.duration,
                    "stream_type": media_state.media_stream_type,
                    "images": media_state.images or [],
                }
            payload["media_status"] = media_status
            return payload

        raise ProviderError(f"Unsupported action '{action}' for GoogleCastProvider")
