import React from 'react';

export default function Navbar({ activeTab, setActiveTab, dbStatus }) {
  const tabs = [
    { id: 'founder', label: 'Founder Ground Truth' },
    { id: 'knowledge', label: 'Knowledge Base & RAG' },
    { id: 'alerts', label: 'Alert Center & Actions' },
    { id: 'metrics', label: 'Deterministic Metrics (15)' },
    { id: 'crosswalk', label: 'Canonical Crosswalk' },
    { id: 'sync', label: 'Supabase Replication' },
  ];

  return (
    <header style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)', position: 'sticky', top: 0, zIndex: 50, padding: '12px 24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '18px' }}>
            J
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
              JARVIS v1
              <span style={{ fontSize: '11px', background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '2px 8px', borderRadius: '12px', border: '1px solid rgba(99,102,241,0.3)' }}>
                Phase 1 Active
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Meridian Supply Chain Intelligence Layer
            </div>
          </div>
        </div>

        <nav style={{ display: 'flex', gap: '8px' }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                border: 'none',
                background: activeTab === tab.id ? '#4f46e5' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : '#94a3b8',
                transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: dbStatus === 'HEALTHY' ? '#4ade80' : '#f87171' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: dbStatus === 'HEALTHY' ? '#4ade80' : '#f87171', display: 'inline-block' }}></span>
            Supabase Live
          </div>
          <div style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1' }}>
            Role: <strong>FOUNDER (EMP-001)</strong>
          </div>
        </div>
      </div>
    </header>
  );
}
