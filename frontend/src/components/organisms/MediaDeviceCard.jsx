import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "../atoms/Button.jsx";
import DeviceCardHeader from "../molecules/DeviceCardHeader.jsx";
import DeviceMeta from "../molecules/DeviceMeta.jsx";
import DeviceActionPanel from "./DeviceActionPanel.jsx";
import { resolveDeviceStatus } from "../../utils/deviceStatus.js";
import { fetchDeviceStatus, sendDeviceCommand } from "../../api/devices.js";

const STATUS_LABELS = {
  PLAYING: "Playing",
  PAUSED: "Paused",
  STOPPED: "Stopped",
  BUFFERING: "Buffering",
  IDLE: "Idle",
};

function formatTime(seconds) {
  if (typeof seconds !== "number" || Number.isNaN(seconds)) {
    return "–";
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function sortImages(images) {
  if (!Array.isArray(images)) return [];
  return [...images].sort((a, b) => {
    const widthA = a?.width || 0;
    const widthB = b?.width || 0;
    return widthB - widthA;
  });
}

export default function MediaDeviceCard({ device, activeWindowSeconds, onRefresh }) {
  const status = resolveDeviceStatus(device, activeWindowSeconds);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [statusPayload, setStatusPayload] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState(null);
  const pollRef = useRef(null);

  const loadStatus = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) {
        setStatusLoading(true);
        setStatusError(null);
      }
      try {
        const response = await fetchDeviceStatus(device.id);
        setStatusPayload(response.result || null);
        setStatusError(null);
      } catch (error) {
        setStatusError(error.message || "Unable to read status");
      } finally {
        setStatusLoading(false);
      }
    },
    [device.id],
  );

  useEffect(() => {
    loadStatus();
    if (pollRef.current) {
      clearInterval(pollRef.current);
    }
    pollRef.current = setInterval(() => {
      loadStatus({ silent: true });
    }, 10000);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [device.id, loadStatus]);

  const handleExecute = async (action, params) => {
    setBusyAction(action);
    setFeedback(null);
    try {
      const response = await sendDeviceCommand(device.id, action, params);
      const resultSummary = response?.result ? JSON.stringify(response.result) : "Command dispatched";
      setFeedback({ type: "success", message: `${action} → ${resultSummary}` });
      await loadStatus({ silent: true });
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      setFeedback({ type: "error", message: error.message || `Failed to run ${action}` });
    } finally {
      setBusyAction(null);
    }
  };

  const mediaStatus = statusPayload?.media_status;
  const deviceVolume = statusPayload?.volume;
  const deviceMuted = statusPayload?.muted;
  const playerStateLabel = useMemo(() => {
    if (!mediaStatus?.player_state) {
      return statusPayload ? "Idle" : "Unknown";
    }
    const upper = mediaStatus.player_state.toUpperCase();
    return STATUS_LABELS[upper] || upper || "Unknown";
  }, [mediaStatus?.player_state, statusPayload]);

  const artwork = useMemo(() => {
    const images = sortImages(mediaStatus?.images);
    return images.length ? images[0].url : null;
  }, [mediaStatus?.images]);

  return (
    <article className={controlsOpen ? "device-card device-card--expanded media-card" : "device-card media-card"}>
      <DeviceCardHeader
        name={device.name || device.ip || `Device #${device.id}`}
        statusLabel={status.label}
        statusKey={status.key}
      />
      <DeviceMeta device={device} />
      <section className="media-card__status">
        <div className="media-card__status-header">
          <span className="media-card__status-title">Now playing</span>
          <div className="media-card__status-actions">
            <Button type="button" onClick={() => loadStatus()} disabled={statusLoading}>
              {statusLoading ? "Refreshing..." : "Refresh status"}
            </Button>
          </div>
        </div>
        {statusError ? <div className="media-card__status-error">{statusError}</div> : null}
        {!statusError ? (
          <div className="media-card__status-body">
            {artwork ? (
              <div className="media-card__artwork">
                <img src={artwork} alt={mediaStatus?.title || "Artwork"} />
              </div>
            ) : null}
            <div className="media-card__details">
              <div className="media-card__state">{playerStateLabel}</div>
              {mediaStatus?.title ? <div className="media-card__title">{mediaStatus.title}</div> : null}
              {mediaStatus?.artist ? <div className="media-card__meta-line">Artist · {mediaStatus.artist}</div> : null}
              {mediaStatus?.album_name ? (
                <div className="media-card__meta-line">Album · {mediaStatus.album_name}</div>
              ) : null}
              <div className="media-card__meta-line">
                App: {statusPayload?.app_name || statusPayload?.app_id || "Unknown"}
              </div>
              <div className="media-card__meta-line">
                Volume: {deviceMuted ? "Muted" : `${deviceVolume ?? "-"}%`}
              </div>
              <div className="media-card__time">
                <span>{formatTime(mediaStatus?.current_time)}</span>
                <span className="media-card__time-separator">/</span>
                <span>{formatTime(mediaStatus?.duration)}</span>
              </div>
            </div>
          </div>
        ) : null}
      </section>
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
        <DeviceActionPanel capabilities={device.capabilities || []} onExecute={handleExecute} busyAction={busyAction} />
      ) : null}
    </article>
  );
}
