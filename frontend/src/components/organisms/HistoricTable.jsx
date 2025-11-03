import { Fragment } from "react";
import StatusPill from "../atoms/StatusPill.jsx";
import { format } from "date-fns";
import { resolveDeviceStatus } from "../../utils/deviceStatus.js";

const formatTimestamp = (value) => {
  if (!value) return "-";
  try {
    return format(new Date(value), "PPpp");
  } catch (error) {
    return value;
  }
};

export default function HistoricTable({
  devices,
  activeWindowSeconds,
  openDeviceId,
  onToggleMenu,
  onRunDiscovery,
  onRemoveDevice,
  busyDeviceId,
  busyAction,
}) {
  if (!devices.length) {
    return <div className="empty-state">No historic devices yet.</div>;
  }

  return (
    <table className="historic-table">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Type</th>
          <th scope="col">Last Seen</th>
          <th scope="col">Status</th>
        </tr>
      </thead>
      <tbody>
        {devices.map((device) => {
          const status = resolveDeviceStatus(device, activeWindowSeconds);
          const isOpen = openDeviceId === device.id;
          const isBusy = busyDeviceId === device.id;

          const handleRowClick = () => {
            if (onToggleMenu) {
              onToggleMenu(device.id);
            }
          };

          const handleRediscover = (event) => {
            event.stopPropagation();
            if (!onRunDiscovery) return;
            onRunDiscovery(device.id);
          };

          const handleRemove = (event) => {
            event.stopPropagation();
            if (!onRemoveDevice) return;
            onRemoveDevice(device.id);
          };

          return (
            <Fragment key={device.id}>
              <tr
                className={isOpen ? "historic-table__row historic-table__row--active" : "historic-table__row"}
                onClick={handleRowClick}
                tabIndex={0}
                role="button"
                aria-expanded={isOpen}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleRowClick();
                  }
                }}
              >
                <td>{device.name || device.ip || `Device #${device.id}`}</td>
                <td>{device.device_type}</td>
                <td>{formatTimestamp(device.last_seen)}</td>
                <td>
                  <StatusPill status={status.key} label={status.label} />
                </td>
              </tr>
              {isOpen ? (
                <tr className="historic-table__menu-row">
                  <td colSpan={4}>
                    <div className="row-menu">
                      <button
                        type="button"
                        className="row-menu__button"
                        onClick={handleRediscover}
                        disabled={isBusy}
                      >
                        {isBusy && busyAction === "rediscover" ? "Running..." : "Run discovery"}
                      </button>
                      <button
                        type="button"
                        className="row-menu__button row-menu__button--danger"
                        onClick={handleRemove}
                        disabled={isBusy}
                      >
                        {isBusy && busyAction === "delete" ? "Removing..." : "Remove device"}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

