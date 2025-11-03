export function resolveDeviceStatus(device, activeWindowSeconds = 600) {
  if (!device) {
    return { key: "unknown", label: "Unknown" };
  }

  const lastSeen = device.last_seen ? new Date(device.last_seen).getTime() : null;
  const cutoff = Date.now() - activeWindowSeconds * 1000;

  if (device.is_online) {
    return { key: "online", label: "Online" };
  }

  if (lastSeen && lastSeen >= cutoff) {
    return { key: "stale", label: "Stale" };
  }

  return { key: "offline", label: "Offline" };
}

