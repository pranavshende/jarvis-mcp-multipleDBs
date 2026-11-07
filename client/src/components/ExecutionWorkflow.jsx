import React, { useState, useEffect } from 'react';

/**
 * ExecutionWorkflow
 * Enterprise AI Execution Workflow & Database Topology Diagram for Jarvis AI.
 * - Shows pipeline stages: Query Understanding, Intent Detection, Orchestration, Parallel Execution, Gemini Reasoning, Citations
 * - Interactive Database & Gateway Topology Diagram:
 *     Visualizes data flow between:
 *     Client UI <-> Fastify Gateway (:4000) <-> [Supabase PostgreSQL 17 | pgvector HNSW | Redis L1 Cache]
 * - Mid-way execution cancellation support
 */

const WORKFLOW_PIPELINE = [
  { id: 'QUERY_UNDERSTANDING', label: 'Query Understanding', defaultSubtext: 'Analyzing query semantics with Gemini' },
  { id: 'INTENT_DETECTION', label: 'Intent & Entity Detection', defaultSubtext: 'Extracting operational intent & entities' },
  { id: 'ORCHESTRATOR', label: 'Business Orchestration', defaultSubtext: 'Planning execution graph' },
  {
    id: 'PARALLEL_EXECUTION',
    isFork: true,
    branches: [
      { id: 'RAG_RETRIEVAL', label: 'RAG Retrieval', defaultSubtext: 'Searching certified operational knowledge' },
      { id: 'SQL_ENGINE', label: 'SQL Engine', defaultSubtext: 'Executing deterministic database metrics' }
    ]
  },
  { id: 'CONTEXT_AGGREGATION', label: 'Context Aggregation', defaultSubtext: 'Synthesizing metrics and policy rules' },
  { id: 'GEMINI_REASONING', label: 'Gemini Reasoning', defaultSubtext: 'Formulating grounded root cause response' },
  { id: 'CITATION_VALIDATION', label: 'Citation Validation', defaultSubtext: 'Validating against certified MSC sources' }
];

export default function ExecutionWorkflow({
  events = [],
  isStreaming = false,
  queryTitle = 'Operational inquiry',
  inline = false,
  route = 'KNOWLEDGE + DATA',
  onClose,
  onStopExecution
}) {
  const [isExpanded, setIsExpanded] = useState(isStreaming);
  const [activeTab, setActiveTab] = useState('diagram'); // 'diagram' | 'stepper'

  // Auto-expand when streaming starts
  useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true);
    }
  }, [isStreaming]);

  // Index events by stage for fast lookup
  const eventMap = {};
  if (Array.isArray(events)) {
    events.forEach((e) => {
      if (e && e.stage) {
        eventMap[e.stage] = e;
      }
    });
  }

  // Format duration dynamically
  const formatDuration = (ms) => {
    if (ms === undefined || ms === null) return '';
    if (ms < 100) return '<0.1s';
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getStageState = (stageId) => {
    const evt = eventMap[stageId];
    if (evt) {
      return {
        status: evt.status || 'completed',
        message: evt.message,
        duration: formatDuration(evt.durationMs),
        metadata: evt.metadata
      };
    }
    if (isStreaming) {
      return { status: 'pending', message: 'Queued in pipeline', duration: '' };
    }
    return { status: 'skipped', message: 'Stage not required', duration: '' };
  };

  const hasAnyEvents = events && events.length > 0;
  const completedStagesCount = WORKFLOW_PIPELINE.filter((s) => {
    if (s.isFork) {
      return getStageState('RAG_RETRIEVAL').status === 'completed' || getStageState('SQL_ENGINE').status === 'completed';
    }
    return getStageState(s.id).status === 'completed';
  }).length;

  const sqlState = getStageState('SQL_ENGINE');
  const ragState = getStageState('RAG_RETRIEVAL');
  const orchestratorState = getStageState('ORCHESTRATOR');

  const isSqlActive = sqlState.status === 'running' || sqlState.status === 'completed';
  const isRagActive = ragState.status === 'running' || ragState.status === 'completed';
  const isCacheHit = orchestratorState.metadata?.fromCache || false;

  // Compact Bar (when collapsed)
  if (inline && !isExpanded && !isStreaming) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          border: '1px solid #e5e5e0',
          borderRadius: '10px',
          padding: '7px 12px',
          margin: '6px 0 10px 0',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
          transition: 'all 0.2s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span style={{ fontSize: '12px', fontWeight: '600', color: '#111827' }}>
            AI Execution & DB Flow Verified
          </span>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>
            ({completedStagesCount} stages • {isSqlActive ? 'Supabase SQL' : ''}{isSqlActive && isRagActive ? ' + ' : ''}{isRagActive ? 'pgvector RAG' : ''})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#0e372d', fontWeight: '600' }}>
          <span>View Architecture Diagram</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        maxWidth: inline ? '100%' : '380px',
        background: '#ffffff',
        border: '1px solid #e5e5e0',
        borderRadius: inline ? '12px' : '16px',
        boxShadow: inline ? '0 2px 8px rgba(0, 0, 0, 0.03)' : '0 4px 20px rgba(0, 0, 0, 0.04)',
        padding: '14px 16px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        margin: inline ? '8px 0 12px 0' : '0',
        transition: 'all 0.2s'
      }}
    >
      {/* Workflow Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#374151', letterSpacing: '0.04em', marginLeft: '4px' }}>
            AI WORKFLOW & DATA TOPOLOGY
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Stop Execution Mid-Way Button */}
          {isStreaming && onStopExecution && (
            <button
              type="button"
              onClick={onStopExecution}
              title="Stop execution mid-way"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                fontSize: '10.5px',
                fontWeight: '700',
                padding: '2px 8px',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#fecaca')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fee2e2')}
            >
              <span>⏹</span>
              <span>Stop</span>
            </button>
          )}

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: isStreaming ? '#14532d' : '#f3f4f6',
              color: isStreaming ? '#4ade80' : '#4b5563',
              fontSize: '10.5px',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '12px'
            }}
          >
            {isStreaming && (
              <span
                style={{
                  width: '5px',
                  height: '5px',
                  borderRadius: '50%',
                  background: '#4ade80',
                  boxShadow: '0 0 8px #4ade80',
                  animation: 'pulse 1.2s infinite'
                }}
              />
            )}
            {isStreaming ? 'Live' : 'Verified'}
          </span>

          {inline && !isStreaming && (
            <button
              onClick={() => setIsExpanded(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#6b7280',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: '600',
                padding: '2px 4px'
              }}
            >
              Collapse ▴
            </button>
          )}

          {onClose && !inline && (
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '2px', fontSize: '12px' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* View Switcher Tabs: Diagram vs Stepper */}
      <div style={{ display: 'flex', gap: '6px', margin: '10px 0 8px 0', borderBottom: '1px solid #f0eee8', paddingBottom: '6px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('diagram')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '5px 8px',
            fontSize: '11.5px',
            fontWeight: '600',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'diagram' ? '#0e372d' : '#f3f2ee',
            color: activeTab === 'diagram' ? '#ffffff' : '#4b5563',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span>☊</span>
          <span>Database & Gateway Flow</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('stepper')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '5px 8px',
            fontSize: '11.5px',
            fontWeight: '600',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'stepper' ? '#0e372d' : '#f3f2ee',
            color: activeTab === 'stepper' ? '#ffffff' : '#4b5563',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span>≡</span>
          <span>Pipeline Stepper</span>
        </button>
      </div>

      {/* Subtitle / Active Query */}
      <div style={{ marginBottom: '10px' }}>
        <h4 style={{ fontSize: '13px', fontWeight: '700', color: '#111827', margin: '0 0 2px 0' }}>
          {isStreaming ? 'Executing Neural Graph...' : (hasAnyEvents ? 'Execution Pipeline Complete' : 'Standby')}
        </h4>
        <p
          style={{
            fontSize: '11.5px',
            color: '#6b7280',
            margin: 0,
            lineHeight: '1.4',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {queryTitle}
        </p>
      </div>

      {/* ======================================================================= */}
      {/* TAB 1: INTERACTIVE DATABASE & GATEWAY TOPOLOGY DIAGRAM                   */}
      {/* ======================================================================= */}
      {activeTab === 'diagram' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          
          {/* Node 1: Client Application (UI / Mobile) */}
          <div
            style={{
              background: '#f8f7f4',
              border: '1px solid #e5e5e0',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>💻</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#111827' }}>
                  Client UI (Web & Mobile)
                </div>
                <div style={{ fontSize: '10px', color: '#6b7280' }}>
                  Query Dispatch • Protocol: HTTPS SSE Stream
                </div>
              </div>
            </div>
            <span style={{ fontSize: '10px', fontWeight: '600', color: '#0e372d', background: '#e8f5ec', padding: '2px 6px', borderRadius: '4px' }}>
              SOURCE
            </span>
          </div>

          {/* Flow Indicator Down to Gateway */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', margin: '-3px 0' }}>
            <span style={{ fontSize: '11px', color: '#0e372d' }}>⬇</span>
            <span style={{ fontSize: '9.5px', color: '#6b7280', fontWeight: '600' }}>
              `POST /api/query/stream` • Bearer Token Auth
            </span>
            <span style={{ fontSize: '11px', color: '#0e372d' }}>⬇</span>
          </div>

          {/* Node 2: Fastify Intelligence Gateway (:4000) */}
          <div
            style={{
              background: '#ffffff',
              border: '1.5px solid #0e372d',
              borderRadius: '9px',
              padding: '10px 12px',
              boxShadow: '0 2px 8px rgba(14, 55, 45, 0.08)',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '13px' }}>⚡</span>
                <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#0e372d' }}>
                  Fastify Intelligence Gateway (:4000)
                </span>
              </div>
              <span style={{ fontSize: '9.5px', background: '#0e372d', color: '#ffffff', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>
                ORCHESTRATOR
              </span>
            </div>

            <div style={{ fontSize: '10.5px', color: '#4b5563', lineHeight: '1.4' }}>
              Gemini 2.5 NLU Intent Router • RBAC Token Guard • L1 Semantic Cache
            </div>

            {/* Active Route Badge */}
            <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#0e372d', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 6px', borderRadius: '4px' }}>
                Route: {route}
              </span>
              {isCacheHit && (
                <span style={{ fontSize: '9.5px', fontWeight: '700', color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>
                  L1 Cache Hit (&lt;15ms)
                </span>
              )}
            </div>
          </div>

          {/* Flow Indicator Down to Databases */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', margin: '-3px 0' }}>
            <span style={{ fontSize: '11px', color: '#3b82f6' }}>⬇</span>
            <span style={{ fontSize: '9.5px', color: '#6b7280', fontWeight: '600' }}>
              Dispatches to Target Databases & Knowledge Repositories
            </span>
            <span style={{ fontSize: '11px', color: '#3b82f6' }}>⬇</span>
          </div>

          {/* Node 3: Target Database Layer (Where data is queried from) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

            {/* DB Branch A: Supabase PostgreSQL 17 (Fact/Dim Star Schema) */}
            <div
              style={{
                background: isSqlActive ? '#f0fdf4' : '#fafafa',
                border: isSqlActive ? '1.5px solid #10b981' : '1px solid #e5e5e0',
                borderRadius: '8px',
                padding: '8px 10px',
                transition: 'all 0.2s',
                boxShadow: isSqlActive ? '0 0 10px rgba(16, 185, 129, 0.15)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px' }}>🗄️</span>
                  <span style={{ fontSize: '11.5px', fontWeight: '700', color: isSqlActive ? '#065f46' : '#6b7280' }}>
                    Supabase PostgreSQL 17 (Analytics Star Schema)
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: '700',
                    color: isSqlActive ? '#047857' : '#9ca3af',
                    background: isSqlActive ? '#d1fae5' : '#f3f4f6',
                    padding: '2px 5px',
                    borderRadius: '4px'
                  }}
                >
                  {sqlState.status === 'running' ? 'QUERIED ⟳' : isSqlActive ? 'ACTIVE SOURCE ✓' : 'STANDBY'}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '3px' }}>
                Tables: <code style={{ color: '#0e372d', fontWeight: '600' }}>fact_packages_received</code>, <code style={{ color: '#0e372d' }}>fact_ar_aging</code>, <code style={{ color: '#0e372d' }}>dim_facility</code>
              </div>
              <div style={{ fontSize: '9.5px', color: '#9ca3af', marginTop: '2px' }}>
                Ingests from: WMS Intake (EWR1/ONT1) • QuickBooks AR Ledger • Partner Portal
              </div>
            </div>

            {/* DB Branch B: pgvector Vector Database (HNSW Cosine) */}
            <div
              style={{
                background: isRagActive ? '#eff6ff' : '#fafafa',
                border: isRagActive ? '1.5px solid #3b82f6' : '1px solid #e5e5e0',
                borderRadius: '8px',
                padding: '8px 10px',
                transition: 'all 0.2s',
                boxShadow: isRagActive ? '0 0 10px rgba(59, 130, 246, 0.15)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px' }}>🧠</span>
                  <span style={{ fontSize: '11.5px', fontWeight: '700', color: isRagActive ? '#1e40af' : '#6b7280' }}>
                    pgvector Vector DB (HNSW Cosine Embeddings)
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: '700',
                    color: isRagActive ? '#1d4ed8' : '#9ca3af',
                    background: isRagActive ? '#dbeafe' : '#f3f4f6',
                    padding: '2px 5px',
                    borderRadius: '4px'
                  }}
                >
                  {ragState.status === 'running' ? 'SEARCHING ⟳' : isRagActive ? 'ACTIVE SOURCE ✓' : 'STANDBY'}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '3px' }}>
                Tables: <code style={{ color: '#1e40af', fontWeight: '600' }}>public.knowledge_chunks</code> (746 chunks from 109 verified documents)
              </div>
              <div style={{ fontSize: '9.5px', color: '#9ca3af', marginTop: '2px' }}>
                Memory: SOP-001–014 • Return Grading • Tier 3 Canonical Global Memory
              </div>
            </div>

            {/* DB Branch C: Redis L1 Composite Semantic Cache */}
            <div
              style={{
                background: isCacheHit ? '#fefce8' : '#fafafa',
                border: isCacheHit ? '1.5px solid #eab308' : '1px solid #e5e5e0',
                borderRadius: '8px',
                padding: '8px 10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '13px' }}>⚡</span>
                  <span style={{ fontSize: '11.5px', fontWeight: '700', color: isCacheHit ? '#854d0e' : '#6b7280' }}>
                    Redis L1 Composite Semantic Cache
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: '700',
                    color: isCacheHit ? '#a16207' : '#9ca3af',
                    background: isCacheHit ? '#fef08a' : '#f3f4f6',
                    padding: '2px 5px',
                    borderRadius: '4px'
                  }}
                >
                  {isCacheHit ? 'HIT (<15ms) ✓' : 'CHECKED'}
                </span>
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
                Sub-100ms In-Memory Key-Value store with SHA-256 parameter hashing.
              </div>
            </div>
          </div>

          {/* Flow Indicator Back Up to Gateway & Client */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px', margin: '-3px 0' }}>
            <span style={{ fontSize: '11px', color: '#10b981' }}>⬆</span>
            <span style={{ fontSize: '9.5px', color: '#0e372d', fontWeight: '700' }}>
              Data & Citations Synthesized with Gemini 2.5 Pro
            </span>
            <span style={{ fontSize: '11px', color: '#10b981' }}>⬆</span>
          </div>

          {/* Node 4: Gateway Response Streamer */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px' }}>📡</span>
              <div>
                <div style={{ fontSize: '12px', fontWeight: '700', color: '#065f46' }}>
                  Gateway Response Streamer (SSE)
                </div>
                <div style={{ fontSize: '10px', color: '#047857' }}>
                  Real-time events: `workflow_event` &rarr; `complete` with verified citations
                </div>
              </div>
            </div>
            <span style={{ fontSize: '10px', fontWeight: '700', color: '#059669', background: '#d1fae5', padding: '2px 6px', borderRadius: '4px' }}>
              STREAMING
            </span>
          </div>
        </div>
      ) : (
        /* ===================================================================== */
        /* TAB 2: STEPPER TIMELINE PIPELINE                                      */
        /* ===================================================================== */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
          {WORKFLOW_PIPELINE.map((stage, sIdx) => {
            // If parallel execution fork (RAG + SQL)
            if (stage.isFork) {
              const isForkActive = ragState.status === 'running' || sqlState.status === 'running';
              const isForkDone = ragState.status === 'completed' || sqlState.status === 'completed';

              return (
                <div key={stage.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative' }}>
                  {sIdx < WORKFLOW_PIPELINE.length - 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '8px',
                        top: '18px',
                        bottom: '-10px',
                        width: '2px',
                        background: isForkDone ? '#10b981' : isForkActive ? '#3b82f6' : '#e5e7eb',
                        zIndex: 1
                      }}
                    />
                  )}

                  {/* Node Status Circle */}
                  <div
                    className={isForkActive ? 'glowing-node' : ''}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      background: isForkDone ? '#10b981' : isForkActive ? '#3b82f6' : '#ffffff',
                      border: isForkDone || isForkActive ? 'none' : '2px solid #d1d5db',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      zIndex: 2,
                      flexShrink: 0
                    }}
                  >
                    {isForkDone ? '✓' : isForkActive ? '⟳' : ''}
                  </div>

                  {/* Fork Branches */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {/* RAG Retrieval Branch */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: '600', color: ragState.status === 'skipped' ? '#9ca3af' : '#111827' }}>
                          RAG Retrieval (pgvector HNSW)
                        </span>
                        {ragState.duration && (
                          <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: '600' }}>✓ {ragState.duration}</span>
                        )}
                        {ragState.status === 'running' && (
                          <span style={{ fontSize: '10.5px', color: '#3b82f6', fontWeight: '600' }} className="spin-slow">⟳ Searching</span>
                        )}
                        {ragState.status === 'skipped' && (
                          <span style={{ fontSize: '10px', color: '#9ca3af', fontStyle: 'italic' }}>— Skipped</span>
                        )}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#6b7280' }}>
                        {ragState.message || stage.branches[0].defaultSubtext}
                      </div>
                    </div>

                    {/* SQL Engine Branch */}
                    {sqlState.status === 'running' ? (
                      <div
                        style={{
                          background: '#faf5ff',
                          border: '1px solid #c084fc',
                          borderRadius: '6px',
                          padding: '6px 8px',
                          marginTop: '2px',
                          boxShadow: '0 0 10px rgba(192, 132, 252, 0.35)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span className="spin-slow" style={{ display: 'inline-block', color: '#7e22ce', fontSize: '11px' }}>⟳</span>
                            <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#581c87' }}>SQL Engine (Supabase Star Schema)</span>
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: '600', color: '#7e22ce' }}>Active</span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#6b21a8', marginTop: '1px' }}>
                          {sqlState.message || 'Executing deterministic database metrics'}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '11.5px', fontWeight: '600', color: sqlState.status === 'skipped' ? '#9ca3af' : '#111827' }}>
                            SQL Engine (Supabase PostgreSQL 17)
                          </span>
                          {sqlState.duration && (
                            <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: '600' }}>✓ {sqlState.duration}</span>
                          )}
                          {sqlState.status === 'skipped' && (
                            <span style={{ fontSize: '10px', color: '#9ca3af', fontStyle: 'italic' }}>— Skipped</span>
                          )}
                        </div>
                        <div style={{ fontSize: '10.5px', color: '#6b7280' }}>
                          {sqlState.message || stage.branches[1].defaultSubtext}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Single Stage Node
            const state = getStageState(stage.id);
            const isDone = state.status === 'completed';
            const isRunning = state.status === 'running';
            const isFailed = state.status === 'failed';
            const isSkipped = state.status === 'skipped';

            return (
              <div key={stage.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative' }}>
                {sIdx < WORKFLOW_PIPELINE.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '18px',
                      bottom: '-10px',
                      width: '2px',
                      background: isDone ? '#10b981' : isRunning ? '#3b82f6' : '#e5e7eb',
                      zIndex: 1
                    }}
                  />
                )}

                {/* Status Circle */}
                <div
                  className={isRunning ? 'glowing-node' : ''}
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    background: isDone ? '#10b981' : isRunning ? '#3b82f6' : isFailed ? '#ef4444' : '#ffffff',
                    border: isDone || isRunning || isFailed ? 'none' : '2px solid #d1d5db',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    zIndex: 2,
                    flexShrink: 0
                  }}
                >
                  {isDone ? '✓' : isRunning ? '⟳' : isFailed ? '!' : isSkipped ? '—' : ''}
                </div>

                {/* Stage Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: isSkipped ? '#9ca3af' : '#111827' }}>
                      {stage.label}
                    </span>
                    {state.duration && isDone && (
                      <span style={{ fontSize: '10.5px', color: '#16a34a', fontWeight: '600' }}>✓ {state.duration}</span>
                    )}
                    {isRunning && (
                      <span style={{ fontSize: '10.5px', color: '#3b82f6', fontWeight: '600' }} className="spin-slow">⟳</span>
                    )}
                    {isSkipped && (
                      <span style={{ fontSize: '10px', color: '#9ca3af', fontStyle: 'italic' }}>— Skipped</span>
                    )}
                  </div>
                  <div style={{ fontSize: '10.5px', color: '#6b7280', marginTop: '1px' }}>
                    {state.message || stage.defaultSubtext}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-slow {
          animation: spin 1.2s linear infinite;
        }
        @keyframes glow-pulse {
          0% { box-shadow: 0 0 4px rgba(59, 130, 246, 0.4); }
          50% { box-shadow: 0 0 12px rgba(59, 130, 246, 0.85); }
          100% { box-shadow: 0 0 4px rgba(59, 130, 246, 0.4); }
        }
        .glowing-node {
          animation: glow-pulse 1.5s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
}
