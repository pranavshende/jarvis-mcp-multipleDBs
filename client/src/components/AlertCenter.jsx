import React, { useState, useEffect } from 'react';
import {
  fetchAlertsSummary,
  fetchAlerts,
  acknowledgeAlert,
  resolveAlert,
  snoozeAlert,
  fetchMonitoringStatus,
  fetchAnomalies,
  triggerMonitoringJob,
  proposeAction,
  fetchPendingActions,
  confirmAction,
  cancelAction,
  fetchActionHistory
} from '../api/client';

export default function AlertCenter() {
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  
  // Monitoring & Anomaly state
  const [monitoringStatus, setMonitoringStatus] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [runningJob, setRunningJob] = useState(null);

  // Restricted Action state
  const [actionHistory, setActionHistory] = useState([]);
  const [activeProposal, setActiveProposal] = useState(null);
  const [confirmInput, setConfirmInput] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState(null);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [statusFilter, severityFilter]);

  async function loadData() {
    try {
      setLoading(true);
      const [sumRes, alertRes, monRes, anomRes, histRes] = await Promise.all([
        fetchAlertsSummary(),
        fetchAlerts(statusFilter, severityFilter, 50),
        fetchMonitoringStatus(),
        fetchAnomalies(),
        fetchActionHistory(10)
      ]);

      if (sumRes.success) setSummary(sumRes.summary);
      if (alertRes.success) setAlerts(alertRes.alerts);
      if (monRes.success) setMonitoringStatus(monRes.status);
      if (anomRes.success) setAnomalies(anomRes.anomalies);
      if (histRes.success) setActionHistory(histRes.history);
    } catch (err) {
      console.error('Failed to load alert center data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAcknowledge(alertId) {
    await acknowledgeAlert(alertId, 'EMP-001 (Founder)');
    loadData();
  }

  async function handleResolve(alertId) {
    const notes = prompt('Enter resolution notes:');
    if (notes !== null) {
      await resolveAlert(alertId, 'EMP-001 (Founder)', notes);
      loadData();
    }
  }

  async function handleSnooze(alertId) {
    const hours = prompt('Snooze duration in hours (e.g. 4):', '4');
    if (hours) {
      await snoozeAlert(alertId, 'EMP-001 (Founder)', parseInt(hours, 10) * 60, 'Operator snoozed');
      loadData();
    }
  }

  async function handleTriggerJob(jobKey) {
    setRunningJob(jobKey);
    try {
      await triggerMonitoringJob(jobKey);
      await loadData();
    } finally {
      setRunningJob(null);
    }
  }

  async function handleOpenActionModal(partnerId) {
    try {
      setActionLoading(true);
      setActionResult(null);
      setConfirmInput('');
      const res = await proposeAction(partnerId, 'ACTION_CREDIT_HOLD', 'EMP-001 (Founder)', 'Credit limit breach detected by Alert Center');
      if (res.success) {
        setActiveProposal(res.proposal);
      } else {
        alert('Failed to propose action: ' + res.error);
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirmAction() {
    if (!activeProposal) return;
    if (confirmInput.trim() !== 'CONFIRM CREDIT HOLD') {
      alert("You must type exact confirmation token 'CONFIRM CREDIT HOLD'");
      return;
    }
    setActionLoading(true);
    try {
      const res = await confirmAction(
        activeProposal.action_id,
        'EMP-001 (Founder)',
        'ROLE_FOUNDER',
        'CONFIRM CREDIT HOLD',
        `idemp_ui_${activeProposal.action_id.slice(0, 8)}`
      );
      if (res.success) {
        setActionResult(res.execution);
        loadData();
      } else {
        alert('Action execution failed: ' + res.error);
      }
    } catch (err) {
      alert('Error during execution: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  }

  const getSeverityBadge = (sev) => {
    switch (sev) {
      case 'CRITICAL':
        return { bg: 'rgba(239,68,68,0.2)', text: '#ef4444', border: 'rgba(239,68,68,0.4)' };
      case 'HIGH':
        return { bg: 'rgba(249,115,22,0.2)', text: '#f97316', border: 'rgba(249,115,22,0.4)' };
      case 'WARNING':
        return { bg: 'rgba(234,179,8,0.2)', text: '#eab308', border: 'rgba(234,179,8,0.4)' };
      default:
        return { bg: 'rgba(59,130,246,0.2)', text: '#3b82f6', border: 'rgba(59,130,246,0.4)' };
    }
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* Title & Actions Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Operational Alert Center & Restricted Actions
            <span style={{ fontSize: '12px', background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.3)' }}>
              Deterministic Engine
            </span>
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
            Real-time proactive anomaly detection, decoupled notification dispatch, and human-gated restricted action execution.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleOpenActionModal('301')}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Initiate Credit Hold (Partner 301)
          </button>
          <button
            onClick={loadData}
            style={{
              background: '#1e293b',
              color: '#e2e8f0',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '10px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            Refresh Feed
          </button>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Active Alerts</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f8fafc', marginTop: '6px' }}>
            {summary?.total_alerts || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            {summary?.new_count || 0} Unacknowledged
          </div>
        </div>
        <div style={{ background: '#0f172a', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#ef4444', textTransform: 'uppercase' }}>Critical Open</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444', marginTop: '6px' }}>
            {summary?.critical_open || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>ACH & Credit Breaches</div>
        </div>
        <div style={{ background: '#0f172a', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#eab308', textTransform: 'uppercase' }}>Warnings Open</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#eab308', marginTop: '6px' }}>
            {summary?.warning_open || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Statistical Outliers</div>
        </div>
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Background Mode</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#38bdf8', marginTop: '8px' }}>
            {monitoringStatus?.mode === 'REDIS_BULLMQ' ? 'Redis 7 Cluster' : 'In-Process Fallback'}
          </div>
          <div style={{ fontSize: '11px', color: '#4ade80', marginTop: '4px' }}>
            Scheduler Active ({monitoringStatus?.scheduler_active ? 'Online' : 'Starting'})
          </div>
        </div>
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Restricted Actions</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#a855f7', marginTop: '6px' }}>
            {actionHistory.length}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Audited in Ledger</div>
        </div>
      </div>

      {/* Main Grid: Alerts Feed + Side Panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* Left Column: Alerts Feed */}
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Operational Alerts Feed</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{ background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px' }}
              >
                <option value="">All Severities</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="HIGH">HIGH</option>
                <option value="WARNING">WARNING</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ background: '#1e293b', color: '#fff', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: '6px', fontSize: '12px' }}
              >
                <option value="">All Statuses</option>
                <option value="NEW">NEW</option>
                <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
                <option value="RESOLVED">RESOLVED</option>
                <option value="SNOOZED">SNOOZED</option>
              </select>
            </div>
          </div>

          {alerts.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', fontSize: '14px' }}>
              No alerts matching the selected filter criteria.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {alerts.map((alert) => {
                const badge = getSeverityBadge(alert.severity);
                return (
                  <div
                    key={alert.id}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ background: badge.bg, color: badge.text, border: `1px solid ${badge.border}`, padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                          {alert.severity}
                        </span>
                        <span style={{ fontWeight: '600', fontSize: '14px', color: '#f8fafc' }}>
                          {alert.title}
                        </span>
                        {alert.occurrence_count > 1 && (
                          <span style={{ background: 'rgba(148,163,184,0.15)', color: '#94a3b8', padding: '2px 6px', borderRadius: '10px', fontSize: '11px' }}>
                            x{alert.occurrence_count} detected
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        {new Date(alert.last_detected_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5' }}>
                      {alert.summary}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                        Type: <strong style={{ color: '#94a3b8' }}>{alert.alert_type}</strong> | Target: <strong style={{ color: '#94a3b8' }}>{alert.entity_type} {alert.entity_id}</strong>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {alert.action_payload?.action_type === 'ACTION_CREDIT_HOLD' && (
                          <button
                            onClick={() => handleOpenActionModal(alert.entity_id)}
                            style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                          >
                            Execute Credit Hold
                          </button>
                        )}
                        {alert.status === 'NEW' && (
                          <button
                            onClick={() => handleAcknowledge(alert.id)}
                            style={{ background: '#334155', color: '#e2e8f0', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                          >
                            Acknowledge
                          </button>
                        )}
                        {alert.status !== 'RESOLVED' && (
                          <>
                            <button
                              onClick={() => handleSnooze(alert.id)}
                              style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Snooze
                            </button>
                            <button
                              onClick={() => handleResolve(alert.id)}
                              style={{ background: 'transparent', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Resolve
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Schedulers & Anomaly Intelligence */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Scheduled Jobs Panel */}
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 14px 0' }}>Monitoring Schedulers</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {monitoringStatus?.jobs && Object.entries(monitoringStatus.jobs).map(([key, job]) => (
                <div
                  key={key}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: '6px',
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#f8fafc' }}>{job.name}</div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>
                      Interval: {Math.round(job.interval_seconds / 60)}m | Status: <strong style={{ color: job.last_status === 'SUCCESS' ? '#4ade80' : '#94a3b8' }}>{job.last_status}</strong>
                    </div>
                  </div>
                  <button
                    disabled={runningJob === key}
                    onClick={() => handleTriggerJob(key)}
                    style={{
                      background: '#1e293b',
                      color: '#38bdf8',
                      border: '1px solid rgba(56,189,248,0.3)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      cursor: runningJob === key ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {runningJob === key ? 'Running...' : 'Run Now'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Statistical Anomaly Intelligence */}
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 14px 0' }}>14-Day Statistical Baselines</h2>
            {anomalies && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '600', color: '#e2e8f0' }}>Inspection Failure Rate</span>
                    <span style={{ color: anomalies.inspection_anomalies?.status === 'NORMAL' ? '#4ade80' : '#eab308', fontWeight: 'bold' }}>
                      {anomalies.inspection_anomalies?.status}
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    Latest: <strong>{anomalies.inspection_anomalies?.latest_value}%</strong> | Baseline Mean: {anomalies.inspection_anomalies?.stats?.mean}% (±{anomalies.inspection_anomalies?.stats?.std_dev}%)
                  </div>
                  <div style={{ color: '#64748b', marginTop: '2px' }}>
                    Z-Score: <strong>{anomalies.inspection_anomalies?.z_score}</strong> | IQR Fence: [{anomalies.inspection_anomalies?.stats?.lower_fence}%, {anomalies.inspection_anomalies?.stats?.upper_fence}%]
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span style={{ fontWeight: '600', color: '#e2e8f0' }}>Daily Dock Scan Volume</span>
                    <span style={{ color: anomalies.dock_anomalies?.status === 'NORMAL' ? '#4ade80' : '#eab308', fontWeight: 'bold' }}>
                      {anomalies.dock_anomalies?.status}
                    </span>
                  </div>
                  <div style={{ color: '#94a3b8' }}>
                    Latest: <strong>{anomalies.dock_anomalies?.latest_value} scans</strong> | Baseline Mean: {anomalies.dock_anomalies?.stats?.mean} scans
                  </div>
                  <div style={{ color: '#64748b', marginTop: '2px' }}>
                    Z-Score: <strong>{anomalies.dock_anomalies?.z_score}</strong> | Outlier: {anomalies.dock_anomalies?.is_iqr_outlier ? 'YES (Below IQR Lower Fence)' : 'NO'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Immutable Action Audit Ledger Table */}
      <div style={{ marginTop: '32px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Immutable Action Audit Ledger
          <span style={{ fontSize: '11px', background: 'rgba(168,85,247,0.2)', color: '#c084fc', padding: '2px 8px', borderRadius: '10px' }}>
            jarvis_system.action_audit_ledger
          </span>
        </h2>
        {actionHistory.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
            No restricted actions executed yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '10px' }}>Timestamp</th>
                  <th style={{ padding: '10px' }}>Action Type</th>
                  <th style={{ padding: '10px' }}>Target Entity</th>
                  <th style={{ padding: '10px' }}>Confirmed By</th>
                  <th style={{ padding: '10px' }}>Idempotency Key</th>
                  <th style={{ padding: '10px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {actionHistory.map((act) => (
                  <tr key={act.action_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#cbd5e1' }}>
                    <td style={{ padding: '10px' }}>{new Date(act.executed_at).toLocaleString()}</td>
                    <td style={{ padding: '10px', fontWeight: '600', color: '#f8fafc' }}>{act.action_type}</td>
                    <td style={{ padding: '10px' }}>{act.target_system} / {act.target_entity_id}</td>
                    <td style={{ padding: '10px' }}>{act.confirmed_by}</td>
                    <td style={{ padding: '10px', fontFamily: 'monospace', color: '#818cf8' }}>{act.idempotency_key}</td>
                    <td style={{ padding: '10px' }}>
                      <span style={{ background: 'rgba(74,222,128,0.2)', color: '#4ade80', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                        {act.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Human Confirmation Modal */}
      {activeProposal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(239,68,68,0.5)',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <span style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.4)', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                  RESTRICTED ACTION PROPOSAL
                </span>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '8px 0 4px 0', color: '#f8fafc' }}>
                  Execute Credit Hold on {activeProposal.partner_info?.partner_name}
                </h3>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Proposal UUID: {activeProposal.action_id}
                </div>
              </div>
              <button
                onClick={() => setActiveProposal(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Financial Details */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '13px' }}>
                <div>Partner ID: <strong>{activeProposal.partner_info?.partner_id}</strong></div>
                <div>Credit Limit: <strong>${activeProposal.partner_info?.credit_limit?.toLocaleString()}</strong></div>
                <div>Total Open AR: <strong style={{ color: '#ef4444' }}>${activeProposal.partner_info?.open_ar?.toLocaleString()}</strong></div>
                <div>Utilization: <strong style={{ color: '#ef4444' }}>{activeProposal.partner_info?.credit_utilization_pct}% (BREACHED)</strong></div>
                <div>Overdue &gt;60 Days: <strong style={{ color: '#f97316' }}>${activeProposal.partner_info?.overdue_60d_plus?.toLocaleString()}</strong></div>
                <div>Open Invoices: <strong>{activeProposal.partner_info?.open_invoices_count}</strong></div>
              </div>
            </div>

            {/* Impact Warning */}
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '8px', padding: '14px', marginBottom: '20px', fontSize: '13px', color: '#fca5a5' }}>
              <strong>Operational Impact:</strong> {activeProposal.impact_assessment?.direct_impact}
              <div style={{ marginTop: '4px', fontSize: '12px', color: '#cbd5e1' }}>
                Requires role authorization: <strong>ROLE_FOUNDER</strong>. LLMs cannot trigger this action autonomously.
              </div>
            </div>

            {actionResult ? (
              <div style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ color: '#4ade80', fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>
                  Action Successfully Executed & Audited!
                </div>
                <div style={{ fontSize: '12px', color: '#cbd5e1' }}>
                  Ledger Action ID: <strong>{actionResult.action_id}</strong><br />
                  Idempotency Key: <strong>{actionResult.idempotency_key}</strong><br />
                  Executed By: <strong>{actionResult.confirmed_by}</strong>
                </div>
                <button
                  onClick={() => setActiveProposal(null)}
                  style={{ marginTop: '12px', background: '#22c55e', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Done
                </button>
              </div>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
                  To confirm, type exact confirmation token: <strong style={{ color: '#fff' }}>CONFIRM CREDIT HOLD</strong>
                </label>
                <input
                  type="text"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="CONFIRM CREDIT HOLD"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: '#1e293b',
                    color: '#fff',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                    marginBottom: '16px'
                  }}
                />

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                  <button
                    onClick={() => setActiveProposal(null)}
                    style={{ background: 'transparent', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '10px 18px', borderRadius: '8px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={confirmInput.trim() !== 'CONFIRM CREDIT HOLD' || actionLoading}
                    onClick={handleConfirmAction}
                    style={{
                      background: confirmInput.trim() === 'CONFIRM CREDIT HOLD' ? '#ef4444' : '#475569',
                      color: '#fff',
                      border: 'none',
                      padding: '10px 20px',
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      cursor: confirmInput.trim() === 'CONFIRM CREDIT HOLD' && !actionLoading ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {actionLoading ? 'Executing...' : 'Confirm & Dispatch Hold'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
