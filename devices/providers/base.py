import abc

class ProviderError(RuntimeError):
	pass

class BaseProvider(abc.ABC):
	"""
	Providers execute commands and optionally translate events into normalised state
	"""

	@abc.abstractmethod
	def command(self, device, action: str, params: dict) -> dict:
		"""
		Execute a command on a device

		Args:
			device: Device model instance
			action: action name, e.g. "turn_on", "set_brightness"
			params: action parameters, e.g. {"brightness": 80}

		Returns:
			dict: result data, e.g. {"status": "ok"}
		"""
		raise NotImplementedError("command method not implemented")