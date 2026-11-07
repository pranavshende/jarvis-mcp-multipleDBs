import React, { useState, useEffect } from 'react';
import { fetchMetricsList, executeMetric } from '../api/client';
import PagePurposeBanner from './PagePurposeBanner';

export default function MetricsExplorer() {
  const [metrics, setMetrics] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('DAILY_PACKAGES_RECEIVED');
  const [targetDate, setTargetDate] = useState('2026-10-19');
  const [targetMonth, setTargetMonth] = useState('2026-09');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadMetrics() {
      const res = await fetchMetricsList();
      if (res.status === 'SUCCESS') {
        setMetrics(res.registered_metrics);
        runQuery('DAILY_PACKAGES_RECEIVED', { date: '2026-10-19' });
      }
    }
    loadMetrics();
  }, []);

  async function runQuery(metricId, params) {
    setLoading(true);
    try {
      const res = await executeMetric(metricId, params);
      setResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleExecute(e) {
    e.preventDefault();
    const params = {
      date: targetDate,
      month: targetMonth,
    };
    runQuery(selectedMetric, params);
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: '#1a1c19' }}>
      <PagePurposeBanner
        pageTitle="Deterministic Business Metrics Engine"
        tagline="15 audit-grade, pre-compiled SQL queries with zero free-form SQL or LLM arithmetic"
        whatItDoes="Allows employees and managers to explore and execute the 15 canonical operational metrics—including daily warehouse receipts, dock-to-stock cycle times, FIFO inventory unit cost calculations, and wholesale accounts receivable aging buckets (0-30, 31-60, 61-90, 90+ days)."
        solutionContribution="Guarantees 100% mathematical precision for high-stakes business calculations across Meridian's operations. Instead of letting LLMs guess numbers or generate unpredictable queries, Jarvis binds every metric to verified, pre-tested database functions with live execution benchmarks."
        badges={[
          '15 Pre-Compiled SQL Metrics',
          'FIFO Valuation Engine',
          'AR Aging & Credit Limits',
          'Dock-to-Stock SLA Tracking',
          'Sub-20ms Query Execution'
        ]}
      />

      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>Deterministic Business Metrics Engine</h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
          Execute all 15 pre-compiled SQL metrics. Zero free-form SQL or LLM arithmetic allowed.
        </p>
      </div>

      {/* Query Controls */}
      <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e0', marginBottom: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <form onSubmit={handleExecute} style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '320px', flex: '1' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Select Registered Business Metric</label>
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #ded9d2',
                background: '#ffffff',
                color: '#111827',
                fontSize: '14px',
              }}
            >
              {metrics.map((m) => (
                <option key={m.metric_id} value={m.metric_id}>
                  [{m.category}] {m.name} ({m.metric_id})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '160px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Target Date</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #ded9d2',
                background: '#ffffff',
                color: '#111827',
                fontSize: '14px',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '160px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#4b5563' }}>Target Month (YYYY-MM)</label>
            <input
              type="text"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              placeholder="2026-09"
              style={{
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid #ded9d2',
                background: '#ffffff',
                color: '#111827',
                fontSize: '14px',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '11px 24px',
              borderRadius: '8px',
              background: '#0e372d',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: '600',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 1px 2px rgba(14, 55, 45, 0.2)'
            }}
          >
            {loading ? 'Executing SQL...' : 'Execute Metric'}
          </button>
        </form>
      </div>

      {/* Results View */}
      {result && result.status === 'SUCCESS' && (
        <div style={{ background: '#ffffff', padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', color: '#0e372d', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {result.result.category} • {result.result.metric_id}
              </span>
              <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginTop: '2px' }}>
                {result.result.metric_name}
              </h2>
              <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
                {result.result.description}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600' }}>
                Execution: {result.result.execution_duration_ms} ms
              </div>
              <div style={{ fontSize: '11px', color: '#6b7280' }}>
                Rows: {result.result.rows_count}
              </div>
            </div>
          </div>

          {result.result.data.length > 0 ? (
            <div style={{ overflowX: 'auto', border: '1px solid #e5e5e0', borderRadius: '8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e5e0', background: '#f8f7f4', color: '#4b5563' }}>
                    {Object.keys(result.result.data[0]).map((col) => (
                      <th key={col} style={{ padding: '12px 14px', fontWeight: '600' }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.result.data.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6', background: idx % 2 === 0 ? '#ffffff' : '#faf9f6' }}>
                      {Object.values(row).map((val, cIdx) => (
                        <td key={cIdx} style={{ padding: '12px 14px', color: '#1f2937' }}>
                          {typeof val === 'number' && !Number.isInteger(val) ? val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(val ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280' }}>
              No rows returned for the given parameters.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
