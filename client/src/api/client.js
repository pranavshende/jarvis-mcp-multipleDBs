// API client for Jarvis v1 Flask Backend

const API_BASE = '/api';

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/health/db`);
  return res.json();
}

export async function fetchMetricsList() {
  const res = await fetch(`${API_BASE}/metrics/list`);
  return res.json();
}

export async function executeMetric(metricId, parameters = {}) {
  const res = await fetch(`${API_BASE}/metrics/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metric_id: metricId, parameters }),
  });
  return res.json();
}

export async function fetchCrosswalkStats() {
  const res = await fetch(`${API_BASE}/crosswalk/stats`);
  return res.json();
}

export async function searchProducts(query = '', limit = 25) {
  const res = await fetch(`${API_BASE}/crosswalk/products?q=${encodeURIComponent(query)}&limit=${limit}`);
  return res.json();
}

export async function lookupOrder(orderId) {
  const res = await fetch(`${API_BASE}/crosswalk/order?order_id=${encodeURIComponent(orderId)}`);
  return res.json();
}

export async function fetchSyncStatus() {
  const res = await fetch(`${API_BASE}/sync/status`);
  return res.json();
}
