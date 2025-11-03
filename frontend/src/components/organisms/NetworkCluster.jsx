import { useMemo, useRef, useState, useEffect, useCallback } from "react";

function polarToCartesian(center, radius, angle) {
  return {
    x: center + radius * Math.cos(angle),
    y: center + radius * Math.sin(angle),
  };
}

export default function NetworkCluster({ cluster }) {
  const size = 720;
  const center = size / 2;
  const radius = 220;
  const devices = cluster.devices || [];
  const [positions, setPositions] = useState({});
  const diagramRef = useRef(null);
  const dragStateRef = useRef(null);

  useEffect(() => {
    if (!devices.length) {
      setPositions({});
      return;
    }

    setPositions((prev) => {
      if (Object.keys(prev).length) {
        return prev;
      }
      const defaults = {};
      const angleStep = (2 * Math.PI) / devices.length;
      devices.forEach((device, index) => {
        let angle = angleStep * index - Math.PI / 2;
        const { x, y } = polarToCartesian(center, radius, angle);
        const offset = (index % 2 === 0 ? 1 : -1) * (radius * 0.15);
        defaults[device.id] = { x: x + offset * Math.cos(angle), y: y + offset * Math.sin(angle) };
      });
      return defaults;
    });
  }, [devices, center, radius]);

  const startDrag = useCallback((deviceId, clientX, clientY) => {
    const current = positions[deviceId] || { x: center, y: center };
    dragStateRef.current = {
      deviceId,
      startX: clientX,
      startY: clientY,
      origX: current.x,
      origY: current.y,
    };
    window.addEventListener("mousemove", handleMouseDrag);
    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchmove", handleTouchDrag, { passive: false });
    window.addEventListener("touchend", endDrag);
  }, [positions, center]);

  const handleMouseDrag = useCallback((event) => {
    const state = dragStateRef.current;
    if (!state) return;
    event.preventDefault();
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    setPositions((prev) => ({
      ...prev,
      [state.deviceId]: {
        x: state.origX + deltaX,
        y: state.origY + deltaY,
      },
    }));
  }, []);

  const handleTouchDrag = useCallback((event) => {
    const state = dragStateRef.current;
    if (!state) return;
    if (!event.touches.length) return;
    event.preventDefault();
    const touch = event.touches[0];
    const deltaX = touch.clientX - state.startX;
    const deltaY = touch.clientY - state.startY;
    setPositions((prev) => ({
      ...prev,
      [state.deviceId]: {
        x: state.origX + deltaX,
        y: state.origY + deltaY,
      },
    }));
  }, []);

  const endDrag = useCallback(() => {
    window.removeEventListener("mousemove", handleMouseDrag);
    window.removeEventListener("mouseup", endDrag);
    window.removeEventListener("touchmove", handleTouchDrag);
    window.removeEventListener("touchend", endDrag);
    dragStateRef.current = null;
  }, [handleMouseDrag, handleTouchDrag]);

  useEffect(() => {
    return () => {
      endDrag();
    };
  }, [endDrag]);

  const nodePositions = useMemo(() => {
    return devices.map((device) => {
      const pos = positions[device.id] || { x: center, y: center };
      return {
        device,
        position: {
          left: `${pos.x}px`,
          top: `${pos.y}px`,
        },
        line: {
          x1: center,
          y1: center,
          x2: pos.x,
          y2: pos.y,
        },
      };
    });
  }, [devices, positions, center]);

  return (
    <div className="network-cluster">
      <div className="network-cluster__diagram" style={{ width: size, height: size }} ref={diagramRef}>
        <svg className="network-cluster__connections" width={size} height={size}>
          {nodePositions.map(({ device, line }) => (
            <line
              key={`line-${device.id}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="rgba(78,205,196,0.35)"
              strokeWidth="1.5"
            />
          ))}
        </svg>
        <div
          className="network-node network-node--gateway"
          style={{
            left: `${center}px`,
            top: `${center}px`,
          }}
        >
          <div className="network-node__name">{cluster.gateway.name}</div>
          <div className="network-node__ip">{cluster.gateway.ip}</div>
        </div>
        {nodePositions.map(({ device, position }) => (
          <div
            key={device.id}
            className={`network-node ${device.is_online ? "network-node--online" : "network-node--offline"}`}
            style={position}
            onMouseDown={(event) => startDrag(device.id, event.clientX, event.clientY)}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              if (touch) {
                startDrag(device.id, touch.clientX, touch.clientY);
              }
            }}
          >
            <div className="network-node__name">{device.name || device.ip}</div>
            <div className="network-node__ip">{device.ip}</div>
          </div>
        ))}
      </div>
      <ul className="network-cluster__list">
        {devices.map((device) => (
          <li key={`list-${device.id}`} className="network-cluster__list-item">
            <span className="network-cluster__list-name">{device.name || device.ip}</span>
            <span className="network-cluster__list-ip">{device.ip}</span>
            <span className="network-cluster__list-vendor">{device.vendor || "Unknown vendor"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
