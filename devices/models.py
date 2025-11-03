from django.db import models
from django.utils import timezone

DEVICE_TYPES = [
    ("light.yeelight", "Yeelight Light"),
    ("doorbell.ring", "Ring Doorbell"),
    ("media.cast", "Google Cast Device"),
    ("network.cisco_router", "Cisco Router"),
    ("network.cisco_switch", "Cisco Switch"),
    ("unknown", "Unknown"),
]

class Device(models.Model):
    name = models.CharField(max_length=120, blank=True, default="")
    ip = models.GenericIPAddressField(null=True, blank=True)
    mac = models.CharField(max_length=32, blank=True, default="")
    device_type = models.CharField(max_length=64, choices=DEVICE_TYPES, default="unknown")

    # SQLite-friendly: store lists and dicts in JSONFields
    capabilities = models.JSONField(default=list)   # e.g. ["on_off","brightness","snapshot"]
    vendor = models.CharField(max_length=80, blank=True, default="")
    meta = models.JSONField(default=dict, blank=True)  # provider data (ids, topics, tokens, raw scan)

    is_online = models.BooleanField(default=True)
    last_seen = models.DateTimeField(default=timezone.now)

    def __str__(self):
        n = self.name or self.ip or self.mac or "Device"
        return f"{n} [{self.device_type}]"
