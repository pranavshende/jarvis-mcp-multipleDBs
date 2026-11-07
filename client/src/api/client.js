// API client for Jarvis v1 Flask Backend (Phase 1 & Phase 2)

const rawGateway = import.meta.env.VITE_GATEWAY_URL || '';
const GATEWAY_BASE = rawGateway.replace(/\/api\/admin\/?$/, '').replace(/\/$/, '');
const API_BASE = GATEWAY_BASE ? `${GATEWAY_BASE}/api` : '/api';

async function safeJson(res, defaultMsg = 'Request failed') {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`${defaultMsg} (HTTP ${res.status}): ${text.substring(0, 100)}`);
    }
    return { message: text };
  }
}

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

export function getAdminHeaders() {
  const token = localStorage.getItem('jarvis_auth_token') || localStorage.getItem('jarvis_mcp_token');
  const headers = {
    'Content-Type': 'application/json'
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// ============================================================================
// Multi-User Authentication & Sessions
// ============================================================================

export async function signupUser(name, email, password) {
  const res = await fetch(`${GATEWAY_BASE}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('jarvis_auth_token', data.token);
  }
  return data;
}

export async function loginUser(email, password) {
  const res = await fetch(`${GATEWAY_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('jarvis_auth_token', data.token);
  }
  return data;
}

export async function logoutUser() {
  const headers = getAdminHeaders();
  localStorage.removeItem('jarvis_auth_token');
  localStorage.removeItem('jarvis_mcp_token');
  localStorage.removeItem('msc_jarvis_active_chat');
  localStorage.removeItem('msc_jarvis_current_session_id');
  localStorage.removeItem('msc_jarvis_sessions');
  try {
    await fetch(`${GATEWAY_BASE}/api/auth/logout`, {
      method: 'POST',
      headers,
      credentials: 'include'
    });
  } catch {}
}

export async function fetchCurrentUser() {
  const token = localStorage.getItem('jarvis_auth_token') || localStorage.getItem('jarvis_mcp_token');
  if (!token) {
    throw new Error('Not authenticated: No active token found in storage.');
  }
  const res = await fetch(`${GATEWAY_BASE}/api/auth/me`, {
    headers: getAdminHeaders(),
    credentials: 'include'
  });
  if (!res.ok) throw new Error('Not authenticated');
  return res.json();
}

// ============================================================================
// PostgreSQL Chat History & Conversations
// ============================================================================

export async function fetchConversations() {
  const res = await fetch(`${GATEWAY_BASE}/api/conversations`, {
    headers: getAdminHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json();
}

export async function createConversation(title = 'New Chat') {
  const res = await fetch(`${GATEWAY_BASE}/api/conversations`, {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ title })
  });
  return res.json();
}

export async function fetchConversationMessages(conversationId) {
  const res = await fetch(`${GATEWAY_BASE}/api/conversations/${conversationId}`, {
    headers: getAdminHeaders()
  });
  if (!res.ok) throw new Error('Failed to fetch conversation history');
  return res.json();
}

export async function renameConversation(conversationId, title) {
  const res = await fetch(`${GATEWAY_BASE}/api/conversations/${conversationId}`, {
    method: 'PATCH',
    headers: getAdminHeaders(),
    body: JSON.stringify({ title })
  });
  return safeJson(res, 'Failed to rename conversation');
}

export async function deleteConversation(conversationId) {
  const res = await fetch(`${GATEWAY_BASE}/api/conversations/${conversationId}`, {
    method: 'DELETE',
    headers: getAdminHeaders()
  });
  return safeJson(res, 'Failed to delete conversation');
}

export async function fetchAdminTokens() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/tokens`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch tokens');
}

export async function createAdminToken(tokenData) {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/tokens`, {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify(tokenData)
  });
  return safeJson(res, 'Failed to create token');
}

export async function revokeAdminToken(tokenId) {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/tokens/${tokenId}/revoke`, {
    method: 'POST',
    headers: getAdminHeaders()
  });
  return safeJson(res, 'Failed to revoke token');
}

export async function deleteAdminToken(tokenId) {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/tokens/${tokenId}`, {
    method: 'DELETE',
    headers: getAdminHeaders()
  });
  return safeJson(res, 'Failed to delete token');
}

export async function rotateAdminToken(tokenId) {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/tokens/${tokenId}/rotate`, {
    method: 'POST',
    headers: getAdminHeaders()
  });
  return safeJson(res, 'Failed to rotate token');
}

export async function fetchAdminModels() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/models`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch models');
}

export async function fetchAdminSpend(days = 30) {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/models/spend?days=${days}`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch spend');
}

export async function fetchAdminHealth() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/health`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch health');
}

export async function queryGatewayIntent(queryText, sessionId = 'default', signal = null) {
  const res = await fetch(`${GATEWAY_BASE}/api/query`, {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ query: queryText, sessionId }),
    signal
  });
  return res.json();
}

export async function queryGatewayStream(queryText, sessionId = 'default', onWorkflowEvent, onComplete, onError, signal = null) {
  try {
    const res = await fetch(`${GATEWAY_BASE}/api/query/stream`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ query: queryText, sessionId }),
      signal
    });

    if (!res.ok) {
      throw new Error(`Streaming failed: HTTP ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      if (signal && signal.aborted) {
        reader.cancel();
        break;
      }
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

    if (buffer.trim()) {
      const eventLines = buffer.split('\n');
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
          if (eventType === 'workflow_event' && onWorkflowEvent) onWorkflowEvent(data);
          else if (eventType === 'complete' && onComplete) onComplete(data);
          else if (eventType === 'error' && onError) onError(new Error(data.error || 'Server stream error'));
        } catch (e) {
          console.error('Failed to parse final SSE payload:', e);
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Stream aborted by user.');
      return;
    }
    if (onError) onError(err);
  }
}

// ============================================================================
// Phase 5: Evaluation, Cache, DLQ, Model Budgets & Security Center APIs
// ============================================================================

export async function fetchAdminEvaluationSummary() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/evaluation/summary`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch evaluation summary');
}

export async function fetchAdminEvaluationRuns() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/evaluation/runs`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch evaluation runs');
}

export async function fetchAdminEvaluationScenarios() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/evaluation/scenarios`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch evaluation scenarios');
}

export async function fetchAdminCacheStats() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/cache/stats`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch cache stats');
}

export async function fetchAdminCacheEntries() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/cache/entries`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch cache entries');
}

export async function invalidateAdminCache(scope = 'ALL', targetValue = null) {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/cache/invalidate`, {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ scope, targetValue })
  });
  return safeJson(res, 'Failed to invalidate cache');
}

export async function fetchAdminBudgets() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/models/budgets`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch budgets');
}

export async function fetchAdminModelUsage() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/models/usage`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch model usage');
}

export async function fetchAdminDLQ() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/dlq`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch DLQ overview');
}

export async function retryAdminDLQJob(jobId, reason = 'Admin Dashboard manual retry') {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/dlq/${encodeURIComponent(jobId)}/retry`, {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ reason })
  });
  return safeJson(res, 'Failed to retry DLQ job');
}

export async function dismissAdminDLQJob(jobId, reason = 'Admin Dashboard manual dismiss') {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/dlq/${encodeURIComponent(jobId)}/dismiss`, {
    method: 'POST',
    headers: getAdminHeaders(),
    body: JSON.stringify({ reason })
  });
  return safeJson(res, 'Failed to dismiss DLQ job');
}

export async function fetchAdminRedTeamResults() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/security/redteam`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch red team results');
}

export async function fetchAdminSecurityEvents() {
  const res = await fetch(`${GATEWAY_BASE}/api/admin/security/events`, { headers: getAdminHeaders() });
  return safeJson(res, 'Failed to fetch security events');
}
