import StatusPill from "../atoms/StatusPill.jsx";

export default function DeviceCardHeader({ name, statusLabel, statusKey }) {
  return (
    <div className="device-card__header">
      <div className="device-card__title">{name}</div>
      <StatusPill status={statusKey} label={statusLabel} />
    </div>
  );
}

