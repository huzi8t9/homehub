import { useState } from "react";
import DeviceCardHeader from "../molecules/DeviceCardHeader.jsx";
import DeviceMeta from "../molecules/DeviceMeta.jsx";
import Button from "../atoms/Button.jsx";
import DeviceActionPanel from "./DeviceActionPanel.jsx";
import { resolveDeviceStatus } from "../../utils/deviceStatus.js";
import { sendDeviceCommand } from "../../api/devices.js";
import MediaDeviceCard from "./MediaDeviceCard.jsx";

export default function DeviceCard({ device, activeWindowSeconds, onRefresh }) {
  if (device.device_type === "media.cast") {
    return (
      <MediaDeviceCard
        device={device}
        activeWindowSeconds={activeWindowSeconds}
        onRefresh={onRefresh}
      />
    );
  }
  return (
    <GenericDeviceCard
      device={device}
      activeWindowSeconds={activeWindowSeconds}
      onRefresh={onRefresh}
    />
  );
}

function GenericDeviceCard({ device, activeWindowSeconds, onRefresh }) {
  const status = resolveDeviceStatus(device, activeWindowSeconds);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const capabilities = device.capabilities || [];

  const handleExecute = async (action, params) => {
    setBusyAction(action);
    setFeedback(null);
    try {
      const response = await sendDeviceCommand(device.id, action, params);
      const resultSummary = response?.result
        ? JSON.stringify(response.result)
        : "Command dispatched";
      setFeedback({ type: "success", message: `${action} → ${resultSummary}` });
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      setFeedback({ type: "error", message: error.message || `Failed to run ${action}` });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <article className={controlsOpen ? "device-card device-card--expanded" : "device-card"}>
      <DeviceCardHeader
        name={device.name || device.ip || `Device #${device.id}`}
        statusLabel={status.label}
        statusKey={status.key}
      />
      <DeviceMeta device={device} />
      <div className="device-card__controls-toggle">
        <Button type="button" onClick={() => setControlsOpen((prev) => !prev)}>
          {controlsOpen ? "Hide controls" : "Controls"}
        </Button>
      </div>
      {feedback ? (
        <div
          className={
            feedback.type === "error"
              ? "device-card__feedback device-card__feedback--error"
              : "device-card__feedback device-card__feedback--success"
          }
        >
          {feedback.message}
        </div>
      ) : null}
      {controlsOpen ? (
        <DeviceActionPanel
          capabilities={capabilities}
          onExecute={handleExecute}
          busyAction={busyAction}
        />
      ) : null}
    </article>
  );
}

