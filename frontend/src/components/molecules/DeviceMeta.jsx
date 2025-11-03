import MetaItem from "../atoms/MetaItem.jsx";
import CapabilityList from "./CapabilityList.jsx";
import { formatDistanceToNowStrict } from "date-fns";

export default function DeviceMeta({ device }) {
  const lastSeenText = device?.last_seen
    ? formatDistanceToNowStrict(new Date(device.last_seen), { addSuffix: true })
    : "unknown";

  return (
    <div className="device-card__meta">
      <MetaItem label="IP" value={device.ip || "-"} />
      <MetaItem label="Vendor" value={device.vendor || "-"} />
      <MetaItem label="Last seen" value={lastSeenText} />
      <CapabilityList capabilities={device.capabilities || []} />
    </div>
  );
}

