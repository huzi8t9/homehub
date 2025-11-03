import { formatDistanceToNowStrict } from "date-fns";
import Button from "../components/atoms/Button.jsx";
import SectionHeading from "../components/atoms/SectionHeading.jsx";
import DeviceGrid from "../components/organisms/DeviceGrid.jsx";
import useDevices from "../hooks/useDevices.js";

function friendlyLastUpdated(lastUpdated) {
  if (!lastUpdated) {
    return "Waiting for first update...";
  }
  return `Updated ${formatDistanceToNowStrict(lastUpdated, { addSuffix: true })}`;
}

export default function ActiveDevicesPage() {
  const { devices, loading, error, refresh, lastUpdated, activeWindowSeconds } = useDevices({ status: "active" });

  return (
    <section>
      <SectionHeading
        title="Active devices"
        actions={
          <Button onClick={refresh} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        }
      />
      <p className="dashboard__subtitle">{friendlyLastUpdated(lastUpdated)}</p>
      {error ? <div className="empty-state">{error.message}</div> : null}
      <DeviceGrid
        devices={devices}
        activeWindowSeconds={activeWindowSeconds}
        onRefresh={refresh}
        emptyMessage={loading ? "Loading devices..." : "No active devices right now."}
      />
    </section>
  );
}

