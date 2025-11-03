"""
Ring doesn't offer a stable local API. We integrate via MQTT events from ring-mqtt
(or Home Assistant). Configure MQTT topics in device.meta, then publish commands
or react to events.

Expected meta:
{
  "mqtt_base": "ring/doorbell/front",
  "stream_url": "rtsp://127.0.0.1:8554/ring_front"  # from ring-mqtt + go2rtc (example)
}
"""

from .base import BaseProvider, ProviderError
import json
import paho.mqtt.publish as publish
import os

MQTT_HOST = os.getenv("MQTT_HOST", "127.0.0.1")
MQTT_PORT = int(os.getenv("MQTT_PORT", "1883"))

class RingProvider(BaseProvider):
	def command(self, device, action: str, params: dict) -> dict:
		meta = device.meta or {}
		mqtt_base = meta.get("mqtt_base")
		if not mqtt_base:
			raise ProviderError("Device meta must include 'mqtt_base' for RingProvider")
		
		if action == "send_chime":
			topic = f"{mqtt_base}/command"
			payload = json.dumps({"action": "chime"})
			try:
				publish.single(topic, payload, hostname=MQTT_HOST, port=MQTT_PORT)
				return {"status": "chime_sent"}
			except Exception as e:
				raise ProviderError(f"Failed to publish MQTT message: {e}")
		
		if action == "open_stream":
			stream_url = meta.get("stream_url")
			if not stream_url:
				raise ProviderError("Device meta must include 'stream_url' to open stream")
			return {"stream_url": stream_url}
		
		if action == "chime_test":
			publish.single(f"{mqtt_base}/chime_test/set", payload="ON", hostname=MQTT_HOST, port=MQTT_PORT)
			return {"status": "chime_test_triggered"}

		raise ProviderError(f"Unsupported action '{action}' for RingProvider")

