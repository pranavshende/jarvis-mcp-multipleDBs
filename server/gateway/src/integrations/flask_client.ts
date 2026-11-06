import { config } from '../config/environment.js';

export interface FlaskResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode: number;
}

export class FlaskClient {
  private static baseUrl = config.flaskBackendUrl;

  private static async request<T = any>(
    path: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any,
    headers: Record<string, string> = {}
  ): Promise<FlaskResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.downstreamTimeoutMs);

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-Jarvis-Internal-Gateway': 'true',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const contentType = res.headers.get('content-type') || '';
      let data: any = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      if (!res.ok) {
        return {
          success: false,
          error: data?.error || data?.message || `HTTP ${res.status}: ${res.statusText}`,
          statusCode: res.status,
          data,
        };
      }

      return {
        success: true,
        data,
        statusCode: res.status,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      const isTimeout = err.name === 'AbortError';
      return {
        success: false,
        error: isTimeout
          ? `Downstream Flask API timeout after ${config.downstreamTimeoutMs}ms`
          : `Failed to connect to Flask backend (${url}): ${err.message}`,
        statusCode: isTimeout ? 504 : 502,
      };
    }
  }

  // --- Phase 1: Deterministic Metrics APIs ---
  public static async executeMetric(metricId: string, params: Record<string, any> = {}) {
    return this.request('/api/metrics/execute', 'POST', { metric_id: metricId, params });
  }

  public static async listMetrics() {
    return this.request('/api/metrics/list', 'GET');
  }

  public static async getSyncStatus() {
    return this.request('/api/sync/status', 'GET');
  }

  // --- Phase 2: Restricted Actions & Alerts APIs ---
  public static async proposeAction(actionType: string, payload: any, proposedBy: string, proposedRole: string, reason: string) {
    return this.request('/api/actions/propose', 'POST', {
      action_type: actionType,
      payload,
      proposed_by: proposedBy,
      proposed_role: proposedRole,
      reason,
    });
  }

  public static async confirmAction(actionId: string, confirmationToken: string, executedBy: string, executedRole: string, idempotencyKey?: string) {
    return this.request(`/api/actions/${actionId}/confirm`, 'POST', {
      confirmation_token: confirmationToken,
      executed_by: executedBy,
      executed_role: executedRole,
      idempotency_key: idempotencyKey,
    });
  }

  public static async getPendingActions() {
    return this.request('/api/actions/pending', 'GET');
  }

  public static async getActionHistory(limit = 50) {
    return this.request(`/api/actions/history?limit=${limit}`, 'GET');
  }

  public static async getAlerts(status = 'ACTIVE') {
    return this.request(`/api/alerts?status=${status}`, 'GET');
  }

  // --- Phase 3: Hybrid RAG & Memory Governance APIs ---
  public static async retrieveKnowledge(query: string, topK = 5, userRole = 'ROLE_USER') {
    return this.request('/api/knowledge/retrieve', 'POST', {
      query,
      top_k: topK,
      user_role: userRole,
    });
  }

  public static async searchKnowledge(query: string) {
    return this.request('/api/knowledge/search', 'POST', { query });
  }

  public static async stageCandidateFact(candidateFact: string, originatingUser: string, sessionId: string, category: string) {
    return this.request('/api/knowledge/candidates', 'POST', {
      candidate_fact: candidateFact,
      originating_user: originatingUser,
      session_id: sessionId,
      category,
    });
  }

  public static async getCandidateFacts() {
    return this.request('/api/knowledge/candidates', 'GET');
  }

  public static async approveCandidateFact(candidateId: string, comments: string, reviewerId: string, reviewerRole: string) {
    return this.request(`/api/knowledge/candidates/${candidateId}/approve`, 'POST', {
      comments,
      reviewer_id: reviewerId,
      reviewer_role: reviewerRole,
    });
  }

  public static async rejectCandidateFact(candidateId: string, comments: string, reviewerId: string, reviewerRole: string) {
    return this.request(`/api/knowledge/candidates/${candidateId}/reject`, 'POST', {
      comments,
      reviewer_id: reviewerId,
      reviewer_role: reviewerRole,
    });
  }

  // --- Health ---
  public static async checkHealth() {
    return this.request('/api/health', 'GET');
  }
}
