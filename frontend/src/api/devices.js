const config = window.APP_CONFIG || {};
const API_BASE = config.apiBaseUrl || "/api/devices/";
const CSRF_TOKEN = config.csrfToken || "";

function buildHeaders(extra = {}) {
  return {
    "Content-Type": "application/json",
    "X-CSRFToken": CSRF_TOKEN,
    ...extra,
  };
}

function deviceUrl(id, suffix = "") {
  const normalizedBase = API_BASE.endsWith("/") ? API_BASE : `${API_BASE}/`;
  return `${normalizedBase}${id}/${suffix}`;
}

export async function rediscoverDevice(deviceId) {
  const response = await fetch(deviceUrl(deviceId, "rediscover/"), {
    method: "POST",
    headers: buildHeaders(),
    credentials: "include",
  });
  if (!response.ok) {
    const message = await extractError(response, "Failed to rediscover device");
    throw new Error(message);
  }
  return response.json();
}

export async function deleteDevice(deviceId) {
  const response = await fetch(deviceUrl(deviceId), {
    method: "DELETE",
    headers: buildHeaders(),
    credentials: "include",
  });
  if (!response.ok) {
    const message = await extractError(response, "Failed to delete device");
    throw new Error(message);
  }
  return true;
}

export async function sendDeviceCommand(deviceId, action, params = {}) {
  const payload = {
    action,
    params,
  };
  const response = await fetch(deviceUrl(deviceId, "command/"), {
    method: "POST",
    headers: buildHeaders(),
    credentials: "include",
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await extractError(response, `Failed to run '${action}'`);
    throw new Error(message);
  }
  return response.json();
}

export async function fetchDeviceStatus(deviceId) {
  const response = await fetch(deviceUrl(deviceId, "status/"), {
    method: "GET",
    headers: buildHeaders(),
    credentials: "include",
  });
  if (!response.ok) {
    const message = await extractError(response, "Failed to fetch device status");
    throw new Error(message);
  }
  return response.json();
}

export async function fetchNetworkGraph() {
  const response = await fetch(`${API_BASE}network/`, {
    method: "GET",
    headers: buildHeaders(),
    credentials: "include",
  });
  if (!response.ok) {
    const message = await extractError(response, "Failed to load network view");
    throw new Error(message);
  }
  return response.json();
}

async function extractError(response, fallback) {
  try {
    const data = await response.json();
    if (data && data.error) {
      return data.error;
    }
  } catch (error) {
    // ignore JSON parse issues
  }
  return fallback;
}

