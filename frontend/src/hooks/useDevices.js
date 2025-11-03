import { useCallback, useEffect, useRef, useState } from "react";

const config = window.APP_CONFIG || {};
const API_BASE = config.apiBaseUrl || "/api/devices/";
const WEBSOCKET_URL = config.websocketUrl;

export default function useDevices({ status = "active", autoRefresh = true, pollIntervalMs = 15000 } = {}) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const abortControllerRef = useRef(null);
  const debounceRef = useRef(null);
  const devicesRef = useRef([]);

  const fetchDevices = useCallback(async ({ showSpinner = false } = {}) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    if (showSpinner || devicesRef.current.length === 0) {
      setLoading(true);
    }

    try {
      const response = await fetch(`${API_BASE}?status=${status}`, {
        signal: controller.signal,
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Failed to load devices (${response.status})`);
      }
      const payload = await response.json();
      devicesRef.current = payload;
      setDevices(payload);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      if (err.name === "AbortError") {
        return;
      }
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchDevices({ showSpinner: true });
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchDevices]);

  useEffect(() => {
    if (!autoRefresh || !WEBSOCKET_URL) {
      return undefined;
    }

    const socket = new WebSocket(WEBSOCKET_URL);

    socket.onmessage = () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        fetchDevices();
        debounceRef.current = null;
      }, 250);
    };

    return () => {
      socket.close();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [autoRefresh, fetchDevices]);

  useEffect(() => {
    if (!autoRefresh || !pollIntervalMs || pollIntervalMs <= 0) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      fetchDevices();
    }, pollIntervalMs);

    return () => clearInterval(intervalId);
  }, [autoRefresh, fetchDevices, pollIntervalMs]);

  return {
    devices,
    loading,
    error,
    lastUpdated,
    refresh: () => fetchDevices({ showSpinner: true }),
    activeWindowSeconds: config.activeWindowSeconds || 600,
  };
}

