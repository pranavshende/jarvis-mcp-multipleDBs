import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import FounderDashboard from './components/FounderDashboard';
import CrosswalkViewer from './components/CrosswalkViewer';
import MetricsExplorer from './components/MetricsExplorer';
import SyncStatusMonitor from './components/SyncStatusMonitor';
import AlertCenter from './components/AlertCenter';
import KnowledgeBase from './components/KnowledgeBase';
import AdminDashboard from './components/AdminDashboard';
import { fetchHealth } from './api/client';

export default function App() {
  const [activeTab, setActiveTab] = useState('founder');
  const [dbStatus, setDbStatus] = useState('CHECKING');

  useEffect(() => {
    async function checkDb() {
      try {
        const res = await fetchHealth();
        setDbStatus(res.status === 'HEALTHY' ? 'HEALTHY' : 'UNHEALTHY');
      } catch {
        setDbStatus('UNHEALTHY');
      }
    }
    checkDb();
    const interval = setInterval(checkDb, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} dbStatus={dbStatus} />
      
      <main style={{ flex: '1' }}>
        {activeTab === 'founder' && <FounderDashboard />}
        {activeTab === 'knowledge' && <KnowledgeBase />}
        {activeTab === 'alerts' && <AlertCenter />}
        {activeTab === 'metrics' && <MetricsExplorer />}
        {activeTab === 'crosswalk' && <CrosswalkViewer />}
        {activeTab === 'sync' && <SyncStatusMonitor />}
        {activeTab === 'admin' && <AdminDashboard />}
      </main>

      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px', textAlign: 'center', fontSize: '12px', color: '#64748b', background: '#0b0f19' }}>
        Jarvis v1 • Meridian Supply Chain Intelligence Platform • Phase 1, 2, 3 & 4 Central Gateway
      </footer>
    </div>
  );
}
