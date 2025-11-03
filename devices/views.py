# devices/views.py
from datetime import timedelta
import ipaddress
from django.conf import settings
from django.db.models import Case, When, Value, IntegerField, Q
from django.middleware.csrf import get_token
from django.utils import timezone
from django.views.generic import TemplateView
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Device
from .serializers import DeviceSerializer
from .providers.yeelight import YeelightProvider
from .providers.ring import RingProvider
from .providers.googlehome import GoogleCastProvider
from .providers.base import ProviderError
from .discovery import run_once_and_upsert, trigger_discovery_run

PROVIDERS = {
    "light.yeelight": YeelightProvider(),
    "doorbell.ring": RingProvider(),
    "media.cast": GoogleCastProvider(),
}

DEFAULT_ACTIVE_WINDOW_SECONDS = 600

class DashboardView(TemplateView):
    template_name = "devices/dashboard.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        active_window = getattr(settings, "DEVICE_ACTIVE_WINDOW_SECONDS", DEFAULT_ACTIVE_WINDOW_SECONDS)
        context["app_config"] = {
            "activeWindowSeconds": active_window,
            "apiBaseUrl": "/api/devices/",
            "websocketUrl": self._build_ws_url(),
        }
        # ensure CSRF cookie/value is available for fetch-based POST commands
        context["app_config"]["csrfToken"] = get_token(self.request)
        return context

    def _build_ws_url(self):
        scheme = "wss" if self.request.is_secure() else "ws"
        host = self.request.get_host()
        return f"{scheme}://{host}/ws/devices"

class DeviceViewSet(viewsets.ModelViewSet):
    queryset = Device.objects.all()
    serializer_class = DeviceSerializer

    def get_queryset(self):
        base_qs = Device.objects.all()
        status_filter = self.request.query_params.get("status")
        active_window = getattr(settings, "DEVICE_ACTIVE_WINDOW_SECONDS", DEFAULT_ACTIVE_WINDOW_SECONDS)
        cutoff = timezone.now() - timedelta(seconds=active_window)

        # Create ordering that prioritizes meaningful names over IP-like names
        # Order by: 1) meaningful names first, 2) then by name alphabetically, 3) then by id
        name_priority = Case(
            # Empty names or IP addresses (patterns like xxx.xxx.xxx.xxx) get lower priority
            When(name__exact='', then=Value(2)),
            When(name__iexact='UNKNOWN', then=Value(2)),
            When(name__regex=r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', then=Value(2)),
            # Everything else gets higher priority
            default=Value(1),
            output_field=IntegerField(),
        )

        if status_filter == "active":
            return (
                base_qs.filter(Q(is_online=True) | Q(last_seen__gte=cutoff))
                .order_by(name_priority, "name", "id")
            )
        if status_filter in {"historic", "inactive"}:
            return base_qs.filter(last_seen__lt=cutoff).order_by("-last_seen")
        return base_qs.order_by(name_priority, "name", "id")

    @action(detail=False, methods=["post"])
    def discover(self, request):
        """Schedule a one-off discovery pass."""
        started = trigger_discovery_run()
        status_text = "started" if started else "already_running"
        http_status = status.HTTP_202_ACCEPTED if started else status.HTTP_200_OK
        return Response({"status": status_text}, status=http_status)

    @action(detail=True, methods=["post"])
    def command(self, request, pk=None):
        device = self.get_object()
        action_name = request.data.get("action")
        params = request.data.get("params", {}) or {}
        provider = PROVIDERS.get(device.device_type)
        if not provider:
            return Response({"error": "No provider for this device type"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = provider.command(device, action_name, params)
            device.last_seen = timezone.now()
            device.save(update_fields=["last_seen"])
            return Response({"result": result})
        except ProviderError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["get"])
    def status(self, request, pk=None):
        device = self.get_object()
        provider = PROVIDERS.get(device.device_type)
        if not provider:
            return Response({"error": "No provider for this device type"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            result = provider.command(device, "status", {})
            return Response({"result": result})
        except ProviderError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"])
    def network(self, request):
        devices = Device.objects.filter(ip__isnull=False)
        grouped = {}
        for device in devices:
            ip = (device.ip or "").strip()
            if not ip:
                continue
            try:
                interface = ipaddress.ip_interface(f"{ip}/24")
                network = interface.network
                gateway_ip = str(next(network.hosts()))
            except (ValueError, StopIteration):
                continue
            
            # Do we have gateway in devices -- get its name
            gateway_name = ""
            try:
                gateway_device = Device.objects.get(ip=gateway_ip)
                gateway_name = gateway_device.name or ""
            except Device.DoesNotExist:
                gateway_name = ""

            entry = grouped.setdefault(
                gateway_ip,
                {
                    "gateway_ip": gateway_ip,
                    "network": str(network),
                    "name": gateway_name,
                    "devices": [],
                },
            )
            entry["devices"].append(
                {
                    "id": device.id,
                    "name": device.name or ip,
                    "ip": ip,
                    "vendor": device.vendor,
                    "device_type": device.device_type,
                    "is_online": device.is_online,
                    "last_seen": device.last_seen.isoformat() if device.last_seen else None,
                }
            )

        payload = []
        for gateway_ip, info in grouped.items():
            payload.append(
                {
                    "gateway": {
                        "id": f"gateway-{gateway_ip}",
                        "ip": gateway_ip,
                        "name": info["name"],
                        "network": info["network"],
                    },
                    "devices": info["devices"],
                }
            )
        payload.sort(key=lambda entry: entry["gateway"]["ip"])
        return Response({"networks": payload})

    @action(detail=True, methods=["post"])
    def rediscover(self, request, pk=None):
        """Schedule a network discovery pass and return the current device snapshot."""
        device = self.get_object()
        started = trigger_discovery_run()
        serializer = self.get_serializer(device)
        payload = {"status": "started" if started else "already_running", "device": serializer.data}
        http_status = status.HTTP_202_ACCEPTED if started else status.HTTP_200_OK
        return Response(payload, status=http_status)
