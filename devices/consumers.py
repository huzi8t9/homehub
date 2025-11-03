import json
from channels.generic.websocket import AsyncJsonWebsocketConsumer

class DeviceConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add("devices", self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        await self.channel_layer.group_discard("devices", self.channel_name)

    async def device_event(self, event):
        # event = {"type":"device.event","payload":{...}}
        await self.send_json(event["payload"])
