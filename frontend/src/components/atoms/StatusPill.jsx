const STATUS_MAP = {
  online: {
    label: "Online",
    className: "status-pill status-pill--online",
    dotColor: "var(--success)",
  },
  offline: {
    label: "Offline",
    className: "status-pill status-pill--offline",
    dotColor: "var(--danger)",
  },
  stale: {
    label: "Stale",
    className: "status-pill status-pill--stale",
    dotColor: "var(--warning)",
  },
  unknown: {
    label: "Unknown",
    className: "status-pill",
    dotColor: "var(--text-muted)",
  },
};

export default function StatusPill({ status = "unknown", label }) {
  const meta = STATUS_MAP[status] || STATUS_MAP.unknown;
  return (
    <span className={meta.className}>
      <span
        className="status-pill__dot"
        style={{ backgroundColor: meta.dotColor }}
        aria-hidden
      />
      {label || meta.label}
    </span>
  );
}

