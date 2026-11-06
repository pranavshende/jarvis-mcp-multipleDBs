// API client for Jarvis v1 Flask Backend (Phase 1 & Phase 2)

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

export async function fetchReconciliationHistory() {
  const res = await fetch(`${API_BASE}/reconciliation/history`);
  return res.json();
}

export async function triggerReconciliation() {
  const res = await fetch(`${API_BASE}/reconciliation/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'MANUAL_DASHBOARD' })
  });
  return res.json();
}

// ----------------------------------------------------------------------------
// Phase 2: Alert Management & Monitoring APIs
// ----------------------------------------------------------------------------

export async function fetchAlertsSummary() {
  const res = await fetch(`${API_BASE}/alerts/summary`);
  return res.json();
}

export async function fetchAlerts(status = '', severity = '', limit = 50) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (severity) params.append('severity', severity);
  if (limit) params.append('limit', limit);
  const res = await fetch(`${API_BASE}/alerts?${params.toString()}`);
  return res.json();
}

export async function fetchAlertById(alertId) {
  const res = await fetch(`${API_BASE}/alerts/${alertId}`);
  return res.json();
}

export async function acknowledgeAlert(alertId, userId = 'EMP-001') {
  const res = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId })
  });
  return res.json();
}

export async function resolveAlert(alertId, userId = 'EMP-001', notes = '') {
  const res = await fetch(`${API_BASE}/alerts/${alertId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, notes })
  });
  return res.json();
}

export async function snoozeAlert(alertId, userId = 'EMP-001', durationMinutes = 240, reason = '') {
  const res = await fetch(`${API_BASE}/alerts/${alertId}/snooze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, duration_minutes: durationMinutes, reason })
  });
  return res.json();
}

export async function recordAlertFeedback(alertId, userId = 'EMP-001', feedbackType = 'NOTE', notes = '') {
  const res = await fetch(`${API_BASE}/alerts/${alertId}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, feedback_type: feedbackType, notes })
  });
  return res.json();
}

export async function fetchMonitoringStatus() {
  const res = await fetch(`${API_BASE}/monitoring/status`);
  return res.json();
}

export async function fetchAnomalies() {
  const res = await fetch(`${API_BASE}/monitoring/anomalies`);
  return res.json();
}

export async function triggerMonitoringJob(jobKey) {
  const res = await fetch(`${API_BASE}/monitoring/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ job: jobKey })
  });
  return res.json();
}

// ----------------------------------------------------------------------------
// Phase 2: Restricted Action Service APIs
// ----------------------------------------------------------------------------

export async function proposeAction(partnerId, actionType = 'ACTION_CREDIT_HOLD', requestedBy = 'EMP-001', reason = '') {
  const res = await fetch(`${API_BASE}/actions/propose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action_type: actionType, partner_id: partnerId, requested_by: requestedBy, reason })
  });
  return res.json();
}

export async function fetchPendingActions() {
  const res = await fetch(`${API_BASE}/actions/pending`);
  return res.json();
}

export async function fetchActionDetails(actionId) {
  const res = await fetch(`${API_BASE}/actions/${actionId}`);
  return res.json();
}

export async function confirmAction(actionId, userId = 'EMP-001', userRole = 'ROLE_FOUNDER', confirmationToken = 'CONFIRM CREDIT HOLD', idempotencyKey = null) {
  const res = await fetch(`${API_BASE}/actions/${actionId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      user_role: userRole,
      confirmation_token: confirmationToken,
      idempotency_key: idempotencyKey
    })
  });
  return res.json();
}

export async function cancelAction(actionId, userId = 'EMP-001', reason = '') {
  const res = await fetch(`${API_BASE}/actions/${actionId}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, reason })
  });
  return res.json();
}

export async function fetchActionHistory(limit = 50) {
  const res = await fetch(`${API_BASE}/actions/history?limit=${limit}`);
  return res.json();
}
