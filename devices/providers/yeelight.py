import socket, json
from contextlib import closing
from .base import BaseProvider, ProviderError

def _yeelight_send(ip, payload: dict, timeout=1.0):
	try:
		with (closing(socket.create_connection((ip, 55443), timeout=timeout))) as sock:
			sock.sendall((json.dumps(payload) + "\r\n").encode("utf-8"))
			sock.settimeout(timeout)
			response = sock.recv(4096).decode(errors="ignore").strip()
			return json.loads(response) if response.startswith("{") else {"raw": response}
	except (socket.timeout, socket.error) as e:
		raise ProviderError(f"Yeelight communication error: {e}")

class YeelightProvider(BaseProvider):
	def command(self, device, action: str, params: dict) -> dict:
		if not device.ip:
			raise ProviderError("Device IP address is required for Yeelight commands")

		method_map = {
			"turn_on": "set_power",
			"turn_off": "set_power",
			"set_brightness": "set_bright",
			"set_color_temp": "set_ct_abx",
			"set_rgb": "set_rgb",
		}

		if action not in method_map:
			raise ProviderError(f"Unsupported action '{action}' for YeelightProvider")

		method = method_map[action]
		payload = {
			"id": 1,
			"method": method,
			"params": [],
		}

		if action in ["turn_on", "turn_off"]:
			payload["params"] = ["on" if action == "turn_on" else "off", "smooth", 500]
		elif action == "set_brightness":
			brightness = params.get("brightness")
			if brightness is None or not (1 <= brightness <= 100):
				raise ProviderError("Brightness must be between 1 and 100")
			payload["params"] = [brightness, "smooth", 500]
		elif action == "set_color_temp":
			ct = params.get("color_temp")
			if ct is None or not (1700 <= ct <= 6500):
				raise ProviderError("Color temperature must be between 1700K and 6500K")
			payload["params"] = [ct, "smooth", 500]
		elif action == "set_rgb":
			rgb = params.get("rgb")
			if rgb is None or not (0 <= rgb <= 16777215):
				raise ProviderError("RGB value must be between 0 and 16777215")
			payload["params"] = [rgb, "smooth", 500]

		return _yeelight_send(device.ip, payload)