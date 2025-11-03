import os
from django.apps import AppConfig
from django.conf import settings

_DISCOVERY_STARTED = False

class DevicesConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "devices"

    def ready(self):
        global _DISCOVERY_STARTED
        if _DISCOVERY_STARTED:
            return
        if not getattr(settings, "DEVICE_DISCOVERY_AUTOSTART", True):
            return

        should_start = (
            os.environ.get("RUN_MAIN") == "true"
            or os.environ.get("DJANGO_ALLOW_ASYNC_UNSAFE")
            or not settings.DEBUG
        )
        if not should_start:
            return

        from .discovery import start_discovery

        interval = getattr(settings, "DEVICE_DISCOVERY_INTERVAL_SECONDS", 30)
        start_discovery(interval=interval)
        _DISCOVERY_STARTED = True
