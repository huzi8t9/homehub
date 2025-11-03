import DeviceCard from "./DeviceCard.jsx";

export default function DeviceGrid({
  devices,
  emptyMessage,
  activeWindowSeconds,
  onRefresh,
}) {
  if (!devices.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="device-grid">
      {devices.map((device) => (
        <DeviceCard
          key={device.id}
          device={device}
          activeWindowSeconds={activeWindowSeconds}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

