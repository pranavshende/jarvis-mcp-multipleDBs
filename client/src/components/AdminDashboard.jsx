import React, { useState, useEffect } from 'react';
import {
  fetchAdminTokens,
  createAdminToken,
  revokeAdminToken,
  rotateAdminToken,
  fetchAdminModels,
  fetchAdminSpend,
  fetchAdminHealth,
  fetchCandidateFacts,
  approveCandidateFact,
  rejectCandidateFact,
  fetchAlerts,
  fetchActionHistory,
  queryGatewayIntent
} from '../api/client';

export default function AdminDashboard() {
  const [activeSection, setActiveSection] = useState('overview');
  const [tokens, setTokens] = useState([]);
  const [models, setModels] = useState(null);
  const [spend, setSpend] = useState([]);
  const [health, setHealth] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // New Token Modal / Display
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [newTokenResult, setNewTokenResult] = useState(null);
  const [formUserId, setFormUserId] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formTokenName, setFormTokenName] = useState('');
  const [formRole, setFormRole] = useState('ROLE_EMPLOYEE');
  const [formDepartment, setFormDepartment] = useState('OPERATIONS');

  // Interactive Query Console
  const [consoleQuery, setConsoleQuery] = useState('');
  const [consoleResult, setConsoleResult] = useState(null);
  const [consoleLoading, setConsoleLoading] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    setError(null);
    try {
      const [tokensRes, modelsRes, spendRes, healthRes, candRes, alertsRes, actionsRes] = await Promise.allSettled([
        fetchAdminTokens(),
        fetchAdminModels(),
        fetchAdminSpend(30),
        fetchAdminHealth(),
        fetchCandidateFacts(),
        fetchAlerts('ACTIVE'),
        fetchActionHistory(20)
      ]);

      if (tokensRes.status === 'fulfilled' && tokensRes.value?.tokens) {
        setTokens(tokensRes.value.tokens);
      }
      if (modelsRes.status === 'fulfilled' && modelsRes.value?.tiers) {
        setModels(modelsRes.value.tiers);
      }
      if (spendRes.status === 'fulfilled' && spendRes.value?.summary) {
        setSpend(spendRes.value.summary);
      }
      if (healthRes.status === 'fulfilled') {
        setHealth(healthRes.value);
      }
      if (candRes.status === 'fulfilled' && candRes.value?.candidates) {
        setCandidates(candRes.value.candidates);
      }
      if (alertsRes.status === 'fulfilled' && alertsRes.value?.alerts) {
        setAlerts(alertsRes.value.alerts);
      }
      if (actionsRes.status === 'fulfilled' && actionsRes.value?.actions) {
        setActions(actionsRes.value.actions);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateToken(e) {
    e.preventDefault();
    if (!formUserId || !formEmail || !formTokenName) return;

    try {
      const res = await createAdminToken({
        userId: formUserId,
        corporateEmail: formEmail,
        tokenName: formTokenName,
        role: formRole,
        department: formDepartment,
        allowedScopes: ['read:metrics', 'read:knowledge']
      });

      if (res.rawToken) {
        setNewTokenResult(res.rawToken);
        setFormUserId('');
        setFormEmail('');
        setFormTokenName('');
        // Reload tokens
        const t = await fetchAdminTokens();
        if (t.tokens) setTokens(t.tokens);
      } else {
        alert(res.message || 'Token creation failed');
      }
    } catch (err) {
      alert(`Error creating token: ${err.message}`);
    }
  }

  async function handleRevokeToken(id) {
    if (!confirm('Are you sure you want to revoke this MCP token? Clients will immediately receive HTTP 401.')) return;
    try {
      await revokeAdminToken(id);
      const t = await fetchAdminTokens();
      if (t.tokens) setTokens(t.tokens);
    } catch (err) {
      alert(`Error revoking token: ${err.message}`);
    }
  }

  async function handleRotateToken(id) {
    if (!confirm('Rotate this token? The old token will be revoked immediately and a new secret generated.')) return;
    try {
      const res = await rotateAdminToken(id);
      if (res.rawToken) {
        alert(`Token Rotated Successfully!\nNew Secret: ${res.rawToken}\nStore it securely now.`);
        const t = await fetchAdminTokens();
        if (t.tokens) setTokens(t.tokens);
      }
    } catch (err) {
      alert(`Error rotating token: ${err.message}`);
    }
  }

  async function handleApproveCandidate(id) {
    try {
      await approveCandidateFact(id, 'EMP-001 (Founder)', 'ROLE_FOUNDER', 'Approved via Admin Dashboard');
      const c = await fetchCandidateFacts();
      if (c.candidates) setCandidates(c.candidates);
    } catch (err) {
      alert(`Approval error: ${err.message}`);
    }
  }

  async function handleRejectCandidate(id) {
    const comments = prompt('Enter rejection reason:') || 'Rejected by Admin';
    try {
      await rejectCandidateFact(id, 'EMP-001 (Founder)', 'ROLE_FOUNDER', comments);
      const c = await fetchCandidateFacts();
      if (c.candidates) setCandidates(c.candidates);
    } catch (err) {
      alert(`Rejection error: ${err.message}`);
    }
  }

  async function handleTestQuery(e) {
    e.preventDefault();
    if (!consoleQuery.trim()) return;
    setConsoleLoading(true);
    setConsoleResult(null);
    try {
      const res = await queryGatewayIntent(consoleQuery.trim());
      setConsoleResult(res);
    } catch (err) {
      setConsoleResult({ error: err.message });
    } finally {
      setConsoleLoading(false);
    }
  }

  const activeTokensCount = tokens.filter(t => t.status === 'ACTIVE').length;
  const totalCost = spend.reduce((acc, row) => acc + parseFloat(row.totalCostUsd || 0), 0);
  const totalTokens = spend.reduce((acc, row) => acc + parseInt(row.totalInputTokens || 0) + parseInt(row.totalOutputTokens || 0), 0);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', color: '#f8fafc' }}>
      {/* Top Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            Jarvis Control Plane & Gateway Admin
            <span style={{ fontSize: '12px', background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.4)' }}>
              Phase 4 Active (Port 4000)
            </span>
          </h1>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '13px' }}>
            Centralized MCP transports, employee token authentication, AI spend tracking, and memory governance.
          </p>
        </div>
        <button
          onClick={loadAllData}
          disabled={loading}
          style={{ padding: '8px 16px', background: '#334155', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
        >
          {loading ? 'Refreshing...' : '↻ Refresh Status'}
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Active MCP Tokens</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#38bdf8', marginTop: '6px' }}>{activeTokensCount} / {tokens.length}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>100% Identity Bound</div>
        </div>
        <div style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total AI Spend (30d)</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#4ade80', marginTop: '6px' }}>${totalCost.toFixed(4)}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Based on Model Registry</div>
        </div>
        <div style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Processed Tokens</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: '#a78bfa', marginTop: '6px' }}>{totalTokens.toLocaleString()}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Fast & Deep Tiers</div>
        </div>
        <div style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Pending Memory Candidates</div>
          <div style={{ fontSize: '24px', fontWeight: '700', color: candidates.length > 0 ? '#fbbf24' : '#94a3b8', marginTop: '6px' }}>{candidates.length}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Tier 2 Governance</div>
        </div>
        <div style={{ background: 'rgba(30,41,59,0.7)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8' }}>Gateway Service Health</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: health?.gateway === 'HEALTHY' ? '#4ade80' : '#f87171', marginTop: '6px' }}>
            {health?.gateway || 'UNKNOWN'}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>DB: {health?.database} • Flask: {health?.flaskBackend}</div>
        </div>
      </div>

      {/* Nav Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px' }}>
        {[
          { id: 'overview', label: '1. Executive Overview & Test Console' },
          { id: 'tokens', label: '2. User & Token Management' },
          { id: 'spend', label: '3. Model Registry & AI Spend' },
          { id: 'memory', label: '4. Memory Approval Queue' },
          { id: 'health', label: '5. System Health & Adapters' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSection(tab.id)}
            style={{
              padding: '10px 16px',
              background: activeSection === tab.id ? '#4f46e5' : 'transparent',
              color: activeSection === tab.id ? '#fff' : '#94a3b8',
              border: 'none',
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              fontWeight: '500',
              fontSize: '13px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Section 1: Executive Overview & Interactive Gateway Console */}
      {activeSection === 'overview' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', color: '#e2e8f0' }}>⚡️ Interactive Gateway Intent Console</h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>
              Test live conversational queries through the central Intent Router (supports Metric Route, Knowledge Route, and Dual Synthesis).
            </p>
            <form onSubmit={handleTestQuery}>
              <textarea
                value={consoleQuery}
                onChange={e => setConsoleQuery(e.target.value)}
                placeholder="e.g., 'What is our partner AR aging breakdown?' or 'What are our approved partner payment terms?'"
                rows={3}
                style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', color: '#fff', fontSize: '13px', resize: 'vertical', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  type="submit"
                  disabled={consoleLoading}
                  style={{ padding: '8px 16px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}
                >
                  {consoleLoading ? 'Routing & Executing...' : 'Execute via Gateway Router'}
                </button>
                <button
                  type="button"
                  onClick={() => setConsoleQuery('What are our partner AR aging balances and what payment terms SOPs apply to them?')}
                  style={{ padding: '8px 12px', background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                >
                  Load Dual-Synthesis Example
                </button>
              </div>
            </form>

            {consoleResult && (
              <div style={{ marginTop: '20px', padding: '14px', background: '#0f172a', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#818cf8', fontWeight: '600' }}>Route: {consoleResult.route}</span>
                  <span style={{ color: '#64748b' }}>Latency: {consoleResult.latencyMs?.toFixed(1)}ms</span>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '8px' }}>
                  Tools Invoked: {consoleResult.toolsInvoked?.join(', ') || 'None'}
                </div>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#e2e8f0', fontFamily: 'monospace', maxHeight: '250px', overflowY: 'auto' }}>
                  {consoleResult.response || JSON.stringify(consoleResult, null, 2)}
                </pre>
              </div>
            )}
          </div>

          <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', color: '#e2e8f0' }}>📡 Supported Protocol Transports</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '12px', background: '#0f172a', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontWeight: '600', color: '#38bdf8', fontSize: '13px' }}>Official MCP Streamable HTTP</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Endpoint: <code>http://127.0.0.1:4000/mcp/stream</code></div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Standard transport for remote MCP clients with 15s keepalive & session resumption.</div>
              </div>
              <div style={{ padding: '12px', background: '#0f172a', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontWeight: '600', color: '#a78bfa', fontSize: '13px' }}>Official MCP stdio Transport</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>CLI Script: <code>node gateway/dist/mcp/stdio_server.js</code></div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>Direct JSON-RPC stdio transport for local Claude Desktop and Cursor.</div>
              </div>
              <div style={{ padding: '12px', background: '#0f172a', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ fontWeight: '600', color: '#4ade80', fontSize: '13px' }}>Slack App in Socket Mode</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Status: {health?.slackSocket || 'STANDBY'}</div>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>WebSocket integration mapping Slack user IDs to corporate emails.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Section 2: User & Token Management */}
      {activeSection === 'tokens' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', margin: 0, color: '#e2e8f0' }}>Provisioned Employee MCP Bearer Tokens</h3>
            <button
              onClick={() => setShowTokenModal(!showTokenModal)}
              style={{ padding: '8px 14px', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
            >
              {showTokenModal ? 'Cancel' : '+ Provision New Token'}
            </button>
          </div>

          {showTokenModal && (
            <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.3)', marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#e2e8f0' }}>Provision New Employee Token</h4>
              <form onSubmit={handleCreateToken} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="User ID (e.g. EMP-006)"
                  value={formUserId}
                  onChange={e => setFormUserId(e.target.value)}
                  required
                  style={{ padding: '8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '13px' }}
                />
                <input
                  type="email"
                  placeholder="Corporate Email"
                  value={formEmail}
                  onChange={e => setFormEmail(e.target.value)}
                  required
                  style={{ padding: '8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '13px' }}
                />
                <input
                  type="text"
                  placeholder="Token Name / Description"
                  value={formTokenName}
                  onChange={e => setFormTokenName(e.target.value)}
                  required
                  style={{ padding: '8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '13px' }}
                />
                <select
                  value={formRole}
                  onChange={e => setFormRole(e.target.value)}
                  style={{ padding: '8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '13px' }}
                >
                  <option value="ROLE_EMPLOYEE">ROLE_EMPLOYEE</option>
                  <option value="ROLE_WAREHOUSE">ROLE_WAREHOUSE</option>
                  <option value="ROLE_SALES">ROLE_SALES</option>
                  <option value="ROLE_FINANCE">ROLE_FINANCE</option>
                  <option value="ROLE_ADMIN">ROLE_ADMIN</option>
                  <option value="ROLE_FOUNDER">ROLE_FOUNDER</option>
                </select>
                <input
                  type="text"
                  placeholder="Department (e.g. OPERATIONS)"
                  value={formDepartment}
                  onChange={e => setFormDepartment(e.target.value)}
                  style={{ padding: '8px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '13px' }}
                />
                <button
                  type="submit"
                  style={{ padding: '8px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}
                >
                  Generate Bearer Token
                </button>
              </form>

              {newTokenResult && (
                <div style={{ marginTop: '14px', padding: '12px', background: 'rgba(16,185,129,0.15)', border: '1px solid #10b981', borderRadius: '6px' }}>
                  <div style={{ fontWeight: '600', color: '#10b981', fontSize: '13px' }}>⚠️ Newly Generated Bearer Token (Shown Once):</div>
                  <code style={{ display: 'block', marginTop: '6px', padding: '8px', background: '#0f172a', borderRadius: '4px', color: '#38bdf8', wordBreak: 'break-all' }}>
                    {newTokenResult}
                  </code>
                </div>
              )}
            </div>
          )}

          <div style={{ background: 'rgba(30,41,59,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                  <th style={{ padding: '12px 16px' }}>Employee</th>
                  <th style={{ padding: '12px 16px' }}>Role</th>
                  <th style={{ padding: '12px 16px' }}>Token Prefix</th>
                  <th style={{ padding: '12px 16px' }}>Allowed Scopes</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((t, idx) => (
                  <tr key={t.id || idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: '600', color: '#e2e8f0' }}>{t.tokenName}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{t.userId} • {t.corporateEmail}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '2px 8px', borderRadius: '4px', fontSize: '11px' }}>
                        {t.role}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <code>{t.tokenPrefix}</code>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '11px' }}>
                      {Array.isArray(t.allowedScopes) ? t.allowedScopes.join(', ') : t.allowedScopes}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ color: t.status === 'ACTIVE' ? '#4ade80' : '#f87171', fontWeight: '500' }}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleRotateToken(t.id)}
                          style={{ padding: '4px 8px', background: '#334155', color: '#cbd5e1', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                        >
                          Rotate
                        </button>
                        {t.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleRevokeToken(t.id)}
                            style={{ padding: '4px 8px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 3: Model Registry & AI Spend */}
      {activeSection === 'spend' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', color: '#e2e8f0' }}>Dynamic Model Registry (models_registry.yaml)</h3>
            {models ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {Object.entries(models).map(([tierKey, tier]) => (
                  <div key={tierKey} style={{ background: '#0f172a', padding: '14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '600', color: '#818cf8', textTransform: 'uppercase', fontSize: '12px' }}>{tierKey}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Timeout: {tier.timeout_ms}ms</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 8px 0' }}>{tier.description}</div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                      Primary: <strong>{tier.primary?.model_id}</strong> (${tier.primary?.cost_in_per_m}/M in, ${tier.primary?.cost_out_per_m}/M out)
                    </div>
                    <div style={{ fontSize: '12px', color: '#cbd5e1', marginTop: '4px' }}>
                      Fallback: <strong>{tier.fallback?.model_id}</strong> (${tier.fallback?.cost_in_per_m}/M in, ${tier.fallback?.cost_out_per_m}/M out)
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div>Loading model registry...</div>
            )}
          </div>

          <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', color: '#e2e8f0' }}>AI Usage & Financial Spend Ledger</h3>
            {spend.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#64748b' }}>No billable queries logged in the last 30 days.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                    <th style={{ padding: '8px' }}>User</th>
                    <th style={{ padding: '8px' }}>Model</th>
                    <th style={{ padding: '8px' }}>Tokens</th>
                    <th style={{ padding: '8px' }}>Cost (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {spend.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '8px' }}>{row.email}</td>
                      <td style={{ padding: '8px' }}><code>{row.modelName}</code></td>
                      <td style={{ padding: '8px' }}>{(parseInt(row.totalInputTokens) + parseInt(row.totalOutputTokens)).toLocaleString()}</td>
                      <td style={{ padding: '8px', color: '#4ade80' }}>${parseFloat(row.totalCostUsd).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Section 4: Memory Approval Queue */}
      {activeSection === 'memory' && (
        <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px' }}>
          <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', color: '#e2e8f0' }}>Tier 2 Memory Approval Queue (Phase 3 Integration)</h3>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>
            Authoritative Domain Leads review staged candidate operational facts before promotion to Tier 3 global company memory.
          </p>
          {candidates.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              No staged candidate facts currently awaiting review.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {candidates.map((c) => (
                <div key={c.id} style={{ background: '#0f172a', padding: '14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', background: 'rgba(251,191,36,0.2)', color: '#fbbf24', padding: '2px 8px', borderRadius: '4px' }}>
                      {c.status || 'PENDING'}
                    </span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Submitted by {c.submitted_by || c.originating_user}</span>
                  </div>
                  <p style={{ margin: '10px 0', fontSize: '14px', color: '#e2e8f0' }}>{c.fact_text || c.candidate_fact}</p>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button
                      onClick={() => handleApproveCandidate(c.id)}
                      style={{ padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      ✓ Approve Fact
                    </button>
                    <button
                      onClick={() => handleRejectCandidate(c.id)}
                      style={{ padding: '6px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}
                    >
                      ✕ Reject Fact
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Section 5: System Health & Adapters */}
      {activeSection === 'health' && (
        <div style={{ background: 'rgba(30,41,59,0.5)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '20px' }}>
          <h3 style={{ fontSize: '16px', margin: '0 0 12px 0', color: '#e2e8f0' }}>End-to-End Enterprise System Topology</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontWeight: '600', color: '#38bdf8' }}>Fastify Gateway (Port 4000)</div>
              <div style={{ fontSize: '13px', color: '#4ade80', marginTop: '6px' }}>● Status: HEALTHY</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>MCP Streamable HTTP & stdio active</div>
            </div>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontWeight: '600', color: '#a78bfa' }}>Flask Backend (Port 5000)</div>
              <div style={{ fontSize: '13px', color: health?.flaskBackend === 'HEALTHY' ? '#4ade80' : '#f87171', marginTop: '6px' }}>
                ● Status: {health?.flaskBackend || 'CHECKING'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Deterministic Metrics & RAG Server</div>
            </div>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontWeight: '600', color: '#fbbf24' }}>Supabase PostgreSQL 17.11</div>
              <div style={{ fontSize: '13px', color: health?.database === 'HEALTHY' ? '#4ade80' : '#f87171', marginTop: '6px' }}>
                ● Status: {health?.database || 'CHECKING'}
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>pgvector v0.8.2 & 6 active schemas</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
