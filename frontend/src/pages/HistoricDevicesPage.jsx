import { useState } from "react";
import Button from "../components/atoms/Button.jsx";
import SectionHeading from "../components/atoms/SectionHeading.jsx";
import HistoricTable from "../components/organisms/HistoricTable.jsx";
import useDevices from "../hooks/useDevices.js";
import { deleteDevice, rediscoverDevice } from "../api/devices.js";

export default function HistoricDevicesPage() {
  const { devices, loading, error, refresh, activeWindowSeconds } = useDevices({
    status: "historic",
    autoRefresh: false,
  });
  const [openDeviceId, setOpenDeviceId] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [busyState, setBusyState] = useState({ deviceId: null, action: null });

  const handleToggleMenu = (deviceId) => {
    setActionError(null);
    setOpenDeviceId((current) => (current === deviceId ? null : deviceId));
  };

  const handleAction = async (deviceId, actionType, runner) => {
    setBusyState({ deviceId, action: actionType });
    setActionError(null);
    try {
      await runner(deviceId);
      setOpenDeviceId(null);
      await refresh();
    } catch (err) {
      setActionError(err.message || `Failed to ${actionType} device`);
    } finally {
      setBusyState({ deviceId: null, action: null });
    }
  };

  const handleRediscover = (deviceId) =>
    handleAction(deviceId, "rediscover", rediscoverDevice);

  const handleDelete = (deviceId) =>
    handleAction(deviceId, "delete", deleteDevice);

  return (
    <section>
      <SectionHeading
        title="Historic devices"
        actions={
          <Button onClick={refresh} disabled={loading || !!busyState.deviceId}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />
      {error ? <div className="empty-state">{error.message}</div> : null}
      {actionError ? <div className="action-banner">{actionError}</div> : null}
      {loading && !devices.length ? <div className="empty-state">Loading history...</div> : null}
      {!loading || devices.length ? (
        <HistoricTable
          devices={devices}
          activeWindowSeconds={activeWindowSeconds}
          openDeviceId={openDeviceId}
          onToggleMenu={handleToggleMenu}
          onRunDiscovery={handleRediscover}
          onRemoveDevice={handleDelete}
          busyDeviceId={busyState.deviceId}
          busyAction={busyState.action}
        />
      ) : null}
    </section>
  );
}

