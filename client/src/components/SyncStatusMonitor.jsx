import React, { useState, useEffect } from 'react';
import { fetchSyncStatus } from '../api/client';

export default function SyncStatusMonitor() {
  const [syncData, setSyncData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetchSyncStatus();
        if (res.status === 'SUCCESS') setSyncData(res.sync_data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc' }}>Supabase Ingestion & Replication Health</h1>
        <p style={{ fontSize: '14px', color: '#94a3b8', marginTop: '4px' }}>
          Real-time status of the 35 staging tables replicating from AWS RDS read replicas into Supabase PostgreSQL.
        </p>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
          Querying Supabase replication metadata...
        </div>
      ) : syncData ? (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Replication Status</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#4ade80', margin: '4px 0' }}>{syncData.status}</div>
              <div style={{ fontSize: '12px', color: '#10b981' }}>{syncData.sync_cadence}</div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Replicated Rows</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#f8fafc', margin: '4px 0' }}>{syncData.total_replicated_rows.toLocaleString()}</div>
              <div style={{ fontSize: '12px', color: '#818cf8' }}>Across 35 Staging Tables</div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Monitored Replication Lag</div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: '#38bdf8', margin: '4px 0' }}>{syncData.replication_lag_minutes} min</div>
              <div style={{ fontSize: '12px', color: '#0284c7' }}>SLA Target: &lt;20 min</div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>Sensitive Data Policy</div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#a78bfa', margin: '4px 0' }}>Zero Banking PII</div>
              <div style={{ fontSize: '12px', color: '#8b5cf6' }}>ACH / SSN Excluded</div>
            </div>
          </div>

          <div style={{ background: 'rgba(30, 41, 59, 0.7)', padding: '20px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f8fafc', marginBottom: '16px' }}>
              Replicated Tables & Row Counts (Supabase Cloud PostgreSQL 17.11)
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {Object.entries(syncData.table_counts).map(([tbl, cnt]) => (
                <div key={tbl} style={{ padding: '10px 14px', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                  <span style={{ color: '#cbd5e1' }}><code>{tbl}</code></span>
                  <strong style={{ color: '#f8fafc' }}>{cnt.toLocaleString()}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
