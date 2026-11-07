// API client for Jarvis v1 Flask Backend (Phase 1 & Phase 2)

const API_BASE = '/api';
const GATEWAY_BASE = import.meta.env.VITE_GATEWAY_URL || '';

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

// ----------------------------------------------------------------------------
// Phase 3: Knowledge Base & RAG Retrieval APIs
// ----------------------------------------------------------------------------

export async function fetchKnowledgeStats() {
  const res = await fetch(`${API_BASE}/knowledge/stats`);
  return res.json();
}

export async function fetchKnowledgeSources(status = '', limit = 50, offset = 0) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  if (limit) params.append('limit', limit);
  if (offset) params.append('offset', offset);
  const res = await fetch(`${API_BASE}/knowledge/sources?${params.toString()}`);
  return res.json();
}

export async function fetchKnowledgeSourceDetails(sourceId) {
  const res = await fetch(`${API_BASE}/knowledge/sources/${sourceId}`);
  return res.json();
}

export async function triggerKnowledgeIngestion(path = 'notes') {
  const res = await fetch(`${API_BASE}/knowledge/sources/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path })
  });
  return res.json();
}

export async function searchKnowledge(query, topK = 5, userRole = 'ROLE_FOUNDER') {
  const res = await fetch(`${API_BASE}/knowledge/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK, user_role: userRole })
  });
  return res.json();
}

export async function retrieveRagContext(query, topK = 5, userRole = 'ROLE_FOUNDER') {
  const res = await fetch(`${API_BASE}/knowledge/retrieve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, top_k: topK, user_role: userRole })
  });
  return res.json();
}

export async function fetchCandidateFacts(status = '') {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  const res = await fetch(`${API_BASE}/knowledge/candidates?${params.toString()}`);
  return res.json();
}

export async function approveCandidateFact(candidateId, reviewerId = 'EMP-001 (Founder)', reviewerRole = 'ROLE_FOUNDER', comments = '') {
  const res = await fetch(`${API_BASE}/knowledge/candidates/${candidateId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer_id: reviewerId, reviewer_role: reviewerRole, comments })
  });
  return res.json();
}

export async function rejectCandidateFact(candidateId, reviewerId = 'EMP-001 (Founder)', reviewerRole = 'ROLE_FOUNDER', comments = '') {
  const res = await fetch(`${API_BASE}/knowledge/candidates/${candidateId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewer_id: reviewerId, reviewer_role: reviewerRole, comments })
  });
  return res.json();
}

export async function fetchGlobalMemory(category = '') {
  const params = new URLSearchParams();
  if (category) params.append('category', category);
  const res = await fetch(`${API_BASE}/knowledge/memory?${params.toString()}`);
  return res.json();
}

// ============================================================================
// Phase 4: Gateway & Admin Control Plane APIs
// ============================================================================

const DEFAULT_ADMIN_TOKEN = 'msc_mcp_founder_sec_7a8f9b1c2d3e4f5a6b7c8d9e0f1a2b3c';

function getAdminHeaders() {
  const token = localStorage.getItem('jarvis_mcp_token') || DEFAULT_ADMIN_TOKEN;
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

export async function fetchAdminTokens() {
  const res = await fetch('/api/admin/tokens', { headers: getAdminHeaders() });
  return res.json();
}

export async function createAdminToken(tokenData) {
  const res = await fetch('/api/admin/tokens', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify(tokenData)
  });
  return res.json();
}

export async function revokeAdminToken(tokenId) {
  const res = await fetch(`/api/admin/tokens/${tokenId}/revoke`, {
    method: 'POST',
    headers: getAdminHeaders()
  });
  return res.json();
}

export async function rotateAdminToken(tokenId) {
  const res = await fetch(`/api/admin/tokens/${tokenId}/rotate`, {
    method: 'POST',
    headers: getAdminHeaders()
  });
  return res.json();
}

export async function fetchAdminModels() {
  const res = await fetch('/api/admin/models', { headers: getAdminHeaders() });
  return res.json();
}

export async function fetchAdminSpend(days = 30) {
  const res = await fetch(`/api/admin/models/spend?days=${days}`, { headers: getAdminHeaders() });
  return res.json();
}

export async function fetchAdminHealth() {
  const res = await fetch('/api/admin/health', { headers: getAdminHeaders() });
  return res.json();
}

export async function queryGatewayIntent(queryText, sessionId = 'default') {
  const res = await fetch(`${GATEWAY_BASE}/api/query`, {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ query: queryText, sessionId })
  });
  return res.json();
}

export async function queryGatewayStream(queryText, sessionId = 'default', onWorkflowEvent, onComplete, onError) {
  try {
    const res = await fetch(`${GATEWAY_BASE}/api/query/stream`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ query: queryText, sessionId }),
    });

    if (!res.ok) {
      throw new Error(`Streaming failed: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() || '';

      for (const block of blocks) {
        if (!block.trim()) continue;
        const eventLines = block.split('\n');
        let eventType = 'message';
        let dataStr = '';

        for (const line of eventLines) {
          if (line.startsWith('event: ')) {
            eventType = line.substring(7).trim();
          } else if (line.startsWith('data: ')) {
            dataStr = line.substring(6).trim();
          }
        }

        if (dataStr) {
          try {
            const data = JSON.parse(dataStr);
            if (eventType === 'workflow_event' && onWorkflowEvent) {
              onWorkflowEvent(data);
            } else if (eventType === 'complete' && onComplete) {
              onComplete(data);
            } else if (eventType === 'error' && onError) {
              onError(new Error(data.error || 'Server stream error'));
            }
          } catch (e) {
            console.error('Failed to parse SSE payload:', e);
          }
        }
      }
    }
  } catch (err) {
    if (onError) onError(err);
  }
}

// ============================================================================
// Phase 5: Evaluation, Cache, DLQ, Model Budgets & Security Center APIs
// ============================================================================

export async function fetchAdminEvaluationSummary() {
  const res = await fetch('/api/admin/evaluation/summary', { headers: getAdminHeaders() });
  return res.json();
}

export async function fetchAdminEvaluationRuns() {
  const res = await fetch('/api/admin/evaluation/runs', { headers: getAdminHeaders() });
  return res.json();
}

export async function fetchAdminEvaluationScenarios() {
  const res = await fetch('/api/admin/evaluation/scenarios', { headers: getAdminHeaders() });
  return res.json();
}

export async function fetchAdminCacheStats() {
  const res = await fetch('/api/admin/cache/stats', { headers: getAdminHeaders() });
  return res.json();
}

export async function fetchAdminCacheEntries() {
  const res = await fetch('/api/admin/cache/entries', { headers: getAdminHeaders() });
  return res.json();
}

export async function invalidateAdminCache(scope = 'ALL', targetValue = null) {
  const res = await fetch('/api/admin/cache/invalidate', {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ scope, targetValue })
  });
  return res.json();
}

export async function fetchAdminBudgets() {
  const res = await fetch('/api/admin/models/budgets', { headers: getAdminHeaders() });
  return res.json();
}

export async function fetchAdminModelUsage() {
  const res = await fetch('/api/admin/models/usage', { headers: getAdminHeaders() });
  return res.json();
}

export async function fetchAdminDLQ() {
  const res = await fetch('/api/admin/dlq', { headers: getAdminHeaders() });
  return res.json();
}

export async function retryAdminDLQJob(jobId, reason = 'Admin Dashboard manual retry') {
  const res = await fetch(`/api/admin/dlq/${encodeURIComponent(jobId)}/retry`, {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ reason })
  });
  return res.json();
}

export async function dismissAdminDLQJob(jobId, reason = 'Admin Dashboard manual dismiss') {
  const res = await fetch(`/api/admin/dlq/${encodeURIComponent(jobId)}/dismiss`, {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ reason })
  });
  return res.json();
}

export async function fetchAdminRedTeamResults() {
  const res = await fetch('/api/admin/security/redteam', { headers: getAdminHeaders() });
  return res.json();
}

export async function fetchAdminSecurityEvents() {
  const res = await fetch('/api/admin/security/events', { headers: getAdminHeaders() });
  return res.json();
}
