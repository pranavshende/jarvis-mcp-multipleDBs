import React, { useState, useEffect } from 'react';

/**
 * ExecutionWorkflow
 * Enterprise AI Execution Workflow & Database Topology Diagram for Jarvis AI.
 * 
 * Features:
 * - Side-by-side integrated layout (Pipeline Stepper + Database & Gateway Topology)
 * - Compact, sleek database & gateway node boxes
 * - Actively moving animated query packet & data flow paths along the connectors
 * - Real-time query location indicator showing exactly where the query has reached
 * - Stop execution mid-way integration
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
  // Default to 'split' (side-by-side) on wide screens, allow toggling to 'diagram' or 'stepper'
  const [activeTab, setActiveTab] = useState('split'); // 'split' | 'diagram' | 'stepper'

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

  const queryState = getStageState('QUERY_UNDERSTANDING');
  const intentState = getStageState('INTENT_DETECTION');
  const orchestratorState = getStageState('ORCHESTRATOR');
  const sqlState = getStageState('SQL_ENGINE');
  const ragState = getStageState('RAG_RETRIEVAL');
  const contextState = getStageState('CONTEXT_AGGREGATION');
  const geminiState = getStageState('GEMINI_REASONING');
  const citationState = getStageState('CITATION_VALIDATION');

  const isSqlActive = sqlState.status === 'running' || sqlState.status === 'completed';
  const isRagActive = ragState.status === 'running' || ragState.status === 'completed';
  const isCacheHit = orchestratorState.metadata?.fromCache || false;

  // Determine current active location of query
  const getQueryLocation = () => {
    if (!hasAnyEvents && !isStreaming) {
      return { stage: 'STANDBY', label: 'Standby • Ready for operational query', node: 'idle' };
    }
    if (citationState.status === 'completed' || (!isStreaming && hasAnyEvents)) {
      return {
        stage: 'DELIVERED',
        label: `Pipeline Complete • Reconciled ${isSqlActive ? 'Supabase Star Schema' : ''}${isSqlActive && isRagActive ? ' + ' : ''}${isRagActive ? 'pgvector Vector DB' : ''} ➔ Delivered to Client`,
        node: 'client_done'
      };
    }
    if (citationState.status === 'running') {
      return { stage: 'VALIDATING', label: 'Validating citations against 109 official documents...', node: 'streamer' };
    }
    if (geminiState.status === 'running') {
      return { stage: 'GEMINI_SYNTHESIS', label: 'Fastify Gateway ➔ Gemini 2.5 Pro synthesizing response...', node: 'gemini' };
    }
    if (contextState.status === 'running') {
      return { stage: 'AGGREGATING', label: 'Reconciling SQL figures with policy knowledge in Gateway...', node: 'gateway' };
    }
    if (sqlState.status === 'running' && ragState.status === 'running') {
      return { stage: 'PARALLEL_QUERY', label: 'Query reached: Supabase PostgreSQL 17 & pgvector Vector DB in parallel', node: 'both_db' };
    }
    if (sqlState.status === 'running') {
      return { stage: 'SQL_QUERY', label: 'Query reached: Supabase PostgreSQL 17 (fact_ar_aging / fact_packages_received)', node: 'supabase' };
    }
    if (ragState.status === 'running') {
      return { stage: 'RAG_SEARCH', label: 'Query reached: pgvector Vector DB (HNSW Cosine • 746 Chunks)', node: 'pgvector' };
    }
    if (orchestratorState.status === 'running') {
      return { stage: 'ORCHESTRATING', label: 'Query reached: Fastify Gateway Intent Router • Evaluating DB routing...', node: 'gateway' };
    }
    if (queryState.status === 'running' || intentState.status === 'running') {
      return { stage: 'NLU_PARSING', label: 'Query reached: Fastify Gateway (:4000) • Gemini NLU Intent Classifier', node: 'gateway' };
    }
    return { stage: 'DISPATCHING', label: 'Client UI ➔ Dispatching over HTTPS SSE Stream to Gateway', node: 'client' };
  };

  const currentLocation = getQueryLocation();

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
            AI Execution &amp; DB Flow Verified
          </span>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>
            ({completedStagesCount} stages • {isSqlActive ? 'Supabase SQL' : ''}{isSqlActive && isRagActive ? ' + ' : ''}{isRagActive ? 'pgvector RAG' : ''})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#0e372d', fontWeight: '600' }}>
          <span>View Architecture Diagram &amp; Flow</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>
    );
  }

  // Render Pipeline Stepper List
  const renderStepper = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative' }}>
      {WORKFLOW_PIPELINE.map((stage, sIdx) => {
        if (stage.isFork) {
          const isForkActive = ragState.status === 'running' || sqlState.status === 'running';
          const isForkDone = ragState.status === 'completed' || sqlState.status === 'completed';

          return (
            <div key={stage.id} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', position: 'relative' }}>
              {sIdx < WORKFLOW_PIPELINE.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: '8px',
                    top: '18px',
                    bottom: '-8px',
                    width: '2px',
                    background: isForkDone ? '#10b981' : isForkActive ? '#3b82f6' : '#e5e7eb',
                    zIndex: 1
                  }}
                />
              )}

              {/* Status Dot */}
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {/* RAG Retrieval Branch */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: ragState.status === 'skipped' ? '#9ca3af' : '#111827' }}>
                      RAG Retrieval (pgvector HNSW)
                    </span>
                    {ragState.duration && (
                      <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600' }}>✓ {ragState.duration}</span>
                    )}
                    {ragState.status === 'running' && (
                      <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: '600' }} className="spin-slow">⟳ Searching</span>
                    )}
                    {ragState.status === 'skipped' && (
                      <span style={{ fontSize: '9.5px', color: '#9ca3af', fontStyle: 'italic' }}>— Skipped</span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>
                    {ragState.message || stage.branches[0].defaultSubtext}
                  </div>
                </div>

                {/* SQL Engine Branch */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: sqlState.status === 'skipped' ? '#9ca3af' : '#111827' }}>
                      SQL Engine (Supabase PostgreSQL 17)
                    </span>
                    {sqlState.duration && (
                      <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600' }}>✓ {sqlState.duration}</span>
                    )}
                    {sqlState.status === 'running' && (
                      <span style={{ fontSize: '10px', color: '#7e22ce', fontWeight: '600' }} className="spin-slow">⟳ Querying</span>
                    )}
                    {sqlState.status === 'skipped' && (
                      <span style={{ fontSize: '9.5px', color: '#9ca3af', fontStyle: 'italic' }}>— Skipped</span>
                    )}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280' }}>
                    {sqlState.message || stage.branches[1].defaultSubtext}
                  </div>
                </div>
              </div>
            </div>
          );
        }

        const state = getStageState(stage.id);
        const isDone = state.status === 'completed';
        const isRunning = state.status === 'running';
        const isFailed = state.status === 'failed';
        const isSkipped = state.status === 'skipped';

        return (
          <div key={stage.id} style={{ display: 'flex', gap: '9px', alignItems: 'flex-start', position: 'relative' }}>
            {sIdx < WORKFLOW_PIPELINE.length - 1 && (
              <div
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '18px',
                  bottom: '-8px',
                  width: '2px',
                  background: isDone ? '#10b981' : isRunning ? '#3b82f6' : '#e5e7eb',
                  zIndex: 1
                }}
              />
            )}

            {/* Status Dot */}
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
                <span style={{ fontSize: '11.5px', fontWeight: '600', color: isSkipped ? '#9ca3af' : '#111827' }}>
                  {stage.label}
                </span>
                {state.duration && isDone && (
                  <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: '600' }}>✓ {state.duration}</span>
                )}
                {isRunning && (
                  <span style={{ fontSize: '10px', color: '#3b82f6', fontWeight: '600' }} className="spin-slow">⟳</span>
                )}
                {isSkipped && (
                  <span style={{ fontSize: '9.5px', color: '#9ca3af', fontStyle: 'italic' }}>— Skipped</span>
                )}
              </div>
              <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '1px' }}>
                {state.message || stage.defaultSubtext}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render Compact Animated Database & Gateway Topology Diagram
  const renderDiagram = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', position: 'relative' }}>
      
      {/* Dynamic Query Location Beacon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          background: isStreaming ? '#ecfdf5' : '#f8f7f4',
          border: isStreaming ? '1px solid #a7f3d0' : '1px solid #e5e5e0',
          borderRadius: '6px',
          padding: '4px 8px',
          marginBottom: '3px'
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isStreaming ? '#10b981' : '#0e372d',
            boxShadow: isStreaming ? '0 0 8px #10b981' : 'none',
            display: 'inline-block',
            animation: isStreaming ? 'pulse 1.2s infinite' : 'none',
            flexShrink: 0
          }}
        />
        <span style={{ fontSize: '10px', fontWeight: '700', color: isStreaming ? '#065f46' : '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {currentLocation.label}
        </span>
      </div>

      {/* NODE 1: Client UI */}
      <div
        className={currentLocation.node === 'client' ? 'active-node-box' : ''}
        style={{
          background: '#ffffff',
          border: currentLocation.node === 'client' ? '1.5px solid #10b981' : '1px solid #e5e5e0',
          borderRadius: '7px',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '13px' }}>💻</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#111827' }}>
              Client UI (Web &amp; Mobile)
            </div>
            <div style={{ fontSize: '9px', color: '#6b7280' }}>
              Query Dispatch • HTTPS SSE Stream
            </div>
          </div>
        </div>
        <span style={{ fontSize: '9px', fontWeight: '700', color: '#0e372d', background: '#e8f5ec', padding: '1px 5px', borderRadius: '4px' }}>
          SOURCE
        </span>
      </div>

      {/* CONNECTOR 1: Animated Query Packet moving to Gateway */}
      <div className="connector-track">
        <svg width="100%" height="20" style={{ display: 'block' }}>
          <line x1="50%" y1="0" x2="50%" y2="20" stroke="#0e372d" strokeWidth="1.5" strokeDasharray="3 3" className="animated-dash-line" />
        </svg>
        <div className="moving-packet" style={{ background: '#0e372d' }} />
        <span style={{ position: 'absolute', right: '10px', top: '2px', fontSize: '8.5px', color: '#6b7280', fontWeight: '600' }}>
          `POST /api/query/stream`
        </span>
      </div>

      {/* NODE 2: Fastify Intelligence Gateway */}
      <div
        className={currentLocation.node === 'gateway' ? 'active-node-box' : ''}
        style={{
          background: '#ffffff',
          border: currentLocation.node === 'gateway' ? '2px solid #0e372d' : '1px solid #0e372d80',
          borderRadius: '7px',
          padding: '7px 10px',
          boxShadow: currentLocation.node === 'gateway' ? '0 0 12px rgba(14,55,45,0.2)' : '0 1px 3px rgba(0,0,0,0.03)',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px' }}>⚡</span>
            <span style={{ fontSize: '11.5px', fontWeight: '700', color: '#0e372d' }}>
              Fastify Intelligence Gateway (:4000)
            </span>
          </div>
          <span style={{ fontSize: '9px', background: '#0e372d', color: '#ffffff', padding: '1px 5px', borderRadius: '4px', fontWeight: '700' }}>
            ORCHESTRATOR
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
          <span style={{ fontSize: '9px', color: '#4b5563' }}>
            Gemini NLU Intent Router • RBAC Policy Guard
          </span>
          <span style={{ fontSize: '9px', fontWeight: '700', color: '#0e372d', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '1px 5px', borderRadius: '4px' }}>
            Route: {route}
          </span>
        </div>
      </div>

      {/* CONNECTOR 2: Split Branch to Target Databases */}
      <div className="connector-track">
        <svg width="100%" height="22" style={{ display: 'block' }}>
          {/* Main vertical line down */}
          <line x1="50%" y1="0" x2="50%" y2="10" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="3 3" className="animated-dash-line" />
          {/* Horizontal split bar */}
          <line x1="20%" y1="10" x2="80%" y2="10" stroke="#3b82f6" strokeWidth="1.5" />
          {/* Left drop to Supabase SQL */}
          <line x1="20%" y1="10" x2="20%" y2="22" stroke={isSqlActive ? '#10b981' : '#cbd5e1'} strokeWidth="1.5" strokeDasharray="3 3" className={isSqlActive ? 'animated-dash-line' : ''} />
          {/* Center drop to Redis */}
          <line x1="50%" y1="10" x2="50%" y2="22" stroke={isCacheHit ? '#f59e0b' : '#cbd5e1'} strokeWidth="1.5" strokeDasharray="3 3" className={isCacheHit ? 'animated-dash-line' : ''} />
          {/* Right drop to pgvector */}
          <line x1="80%" y1="10" x2="80%" y2="22" stroke={isRagActive ? '#3b82f6' : '#cbd5e1'} strokeWidth="1.5" strokeDasharray="3 3" className={isRagActive ? 'animated-dash-line' : ''} />
        </svg>
        {isSqlActive && <div className="moving-packet-branch" style={{ left: '20%', background: '#10b981' }} />}
        {isCacheHit && <div className="moving-packet-branch" style={{ left: '50%', background: '#f59e0b' }} />}
        {isRagActive && <div className="moving-packet-branch" style={{ left: '80%', background: '#3b82f6' }} />}
      </div>

      {/* NODE 3: Compact Database Grid (Postgres SQL + pgvector + Redis) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
        
        {/* DB 3A: Supabase PostgreSQL 17 Star Schema */}
        <div
          className={sqlState.status === 'running' ? 'active-node-box' : ''}
          style={{
            background: isSqlActive ? '#f0fdf4' : '#fafafa',
            border: isSqlActive ? '1.5px solid #10b981' : '1px solid #e5e5e0',
            borderRadius: '6px',
            padding: '5px 8px',
            transition: 'all 0.2s',
            boxShadow: isSqlActive ? '0 0 8px rgba(16,185,129,0.2)' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px' }}>🗄️</span>
              <span style={{ fontSize: '10.5px', fontWeight: '700', color: isSqlActive ? '#065f46' : '#4b5563' }}>
                PostgreSQL 17
              </span>
            </div>
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: '700',
                color: isSqlActive ? '#047857' : '#9ca3af',
                background: isSqlActive ? '#d1fae5' : '#f3f4f6',
                padding: '1px 4px',
                borderRadius: '3px'
              }}
            >
              {sqlState.status === 'running' ? 'QUERYING ⟳' : isSqlActive ? 'ACTIVE ✓' : 'STANDBY'}
            </span>
          </div>
          <div style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            fact_packages, fact_ar_aging
          </div>
        </div>

        {/* DB 3B: pgvector Vector DB (HNSW Cosine) */}
        <div
          className={ragState.status === 'running' ? 'active-node-box' : ''}
          style={{
            background: isRagActive ? '#eff6ff' : '#fafafa',
            border: isRagActive ? '1.5px solid #3b82f6' : '1px solid #e5e5e0',
            borderRadius: '6px',
            padding: '5px 8px',
            transition: 'all 0.2s',
            boxShadow: isRagActive ? '0 0 8px rgba(59,130,246,0.2)' : 'none'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px' }}>🧠</span>
              <span style={{ fontSize: '10.5px', fontWeight: '700', color: isRagActive ? '#1e40af' : '#4b5563' }}>
                pgvector HNSW
              </span>
            </div>
            <span
              style={{
                fontSize: '8.5px',
                fontWeight: '700',
                color: isRagActive ? '#1d4ed8' : '#9ca3af',
                background: isRagActive ? '#dbeafe' : '#f3f4f6',
                padding: '1px 4px',
                borderRadius: '3px'
              }}
            >
              {ragState.status === 'running' ? 'SEARCHING ⟳' : isRagActive ? 'ACTIVE ✓' : 'STANDBY'}
            </span>
          </div>
          <div style={{ fontSize: '8.5px', color: '#6b7280', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            746 chunks • 109 verified SOPs
          </div>
        </div>
      </div>

      {/* DB 3C: Redis L1 Cache (Compact Strip) */}
      <div
        style={{
          background: isCacheHit ? '#fefce8' : '#fafafa',
          border: isCacheHit ? '1.5px solid #eab308' : '1px solid #e5e5e0',
          borderRadius: '5px',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ fontSize: '11px' }}>⚡</span>
          <span style={{ fontSize: '10px', fontWeight: '600', color: isCacheHit ? '#854d0e' : '#6b7280' }}>
            Redis L1 Cache (SHA-256 Memory)
          </span>
        </div>
        <span
          style={{
            fontSize: '8.5px',
            fontWeight: '700',
            color: isCacheHit ? '#a16207' : '#9ca3af',
            background: isCacheHit ? '#fef08a' : '#f3f4f6',
            padding: '1px 4px',
            borderRadius: '3px'
          }}
        >
          {isCacheHit ? 'HIT (<15ms) ✓' : 'CHECKED'}
        </span>
      </div>

      {/* CONNECTOR 3: Returning from DBs to Gateway Gemini Synthesis */}
      <div className="connector-track">
        <svg width="100%" height="20" style={{ display: 'block' }}>
          <line x1="50%" y1="0" x2="50%" y2="20" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" className="animated-dash-line" />
        </svg>
        <div className="moving-packet" style={{ background: '#10b981' }} />
        <span style={{ position: 'absolute', right: '10px', top: '2px', fontSize: '8.5px', color: '#047857', fontWeight: '600' }}>
          ↑ Reconciled SQL Facts + RAG Knowledge
        </span>
      </div>

      {/* NODE 4: Gemini Reasoning & Dual-Synthesis */}
      <div
        className={currentLocation.node === 'gemini' ? 'active-node-box' : ''}
        style={{
          background: '#ffffff',
          border: currentLocation.node === 'gemini' ? '1.5px solid #8b5cf6' : '1px solid #e5e5e0',
          borderRadius: '7px',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s',
          boxShadow: currentLocation.node === 'gemini' ? '0 0 10px rgba(139,92,246,0.25)' : 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px' }}>✨</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#111827' }}>
              Gemini 2.5 Pro (Deep Tier Reasoning)
            </div>
            <div style={{ fontSize: '9px', color: '#6b7280' }}>
              Dual-Synthesis • Strict MSC Citation Grounding
            </div>
          </div>
        </div>
        <span
          style={{
            fontSize: '9px',
            fontWeight: '700',
            color: geminiState.status === 'running' ? '#7c3aed' : '#059669',
            background: geminiState.status === 'running' ? '#ede9fe' : '#d1fae5',
            padding: '1px 5px',
            borderRadius: '4px'
          }}
        >
          {geminiState.status === 'running' ? 'SYNTHESIZING ⟳' : 'GROUNDED ✓'}
        </span>
      </div>

      {/* CONNECTOR 4: Streaming to Client */}
      <div className="connector-track">
        <svg width="100%" height="20" style={{ display: 'block' }}>
          <line x1="50%" y1="0" x2="50%" y2="20" stroke="#059669" strokeWidth="1.5" strokeDasharray="3 3" className="animated-dash-line" />
        </svg>
        <div className="moving-packet" style={{ background: '#059669' }} />
        <span style={{ position: 'absolute', right: '10px', top: '2px', fontSize: '8.5px', color: '#059669', fontWeight: '600' }}>
          `workflow_event` &rarr; `complete`
        </span>
      </div>

      {/* NODE 5: Gateway Response Streamer */}
      <div
        className={currentLocation.node === 'streamer' || currentLocation.node === 'client_done' ? 'active-node-box' : ''}
        style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '7px',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px' }}>📡</span>
          <div>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#065f46' }}>
              Gateway Response Streamer (SSE)
            </div>
            <div style={{ fontSize: '9px', color: '#047857' }}>
              Real-time chunked telemetry delivered to Client UI
            </div>
          </div>
        </div>
        <span style={{ fontSize: '9px', fontWeight: '700', color: '#059669', background: '#d1fae5', padding: '1px 5px', borderRadius: '4px' }}>
          {isStreaming ? 'STREAMING' : 'DELIVERED ✓'}
        </span>
      </div>

    </div>
  );

  return (
    <div
      style={{
        width: '100%',
        maxWidth: inline ? '100%' : '100%',
        background: '#ffffff',
        border: '1px solid #e5e5e0',
        borderRadius: inline ? '12px' : '16px',
        boxShadow: inline ? '0 2px 8px rgba(0, 0, 0, 0.03)' : '0 4px 20px rgba(0, 0, 0, 0.04)',
        padding: '12px 14px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        margin: inline ? '8px 0 12px 0' : '0',
        transition: 'all 0.2s'
      }}
    >
      {/* Workflow Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#374151', letterSpacing: '0.04em', marginLeft: '4px' }}>
            AI WORKFLOW &amp; DATA TOPOLOGY
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
            {isStreaming ? 'Live Streaming' : 'Verified Pipeline'}
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

      {/* View Switcher Tabs: Side-by-Side (Split) vs Database Flow vs Stepper */}
      <div style={{ display: 'flex', gap: '5px', margin: '8px 0', borderBottom: '1px solid #f0eee8', paddingBottom: '6px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('split')}
          style={{
            flex: 1.3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            padding: '5px 8px',
            fontSize: '11px',
            fontWeight: '600',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'split' ? '#0e372d' : '#f3f2ee',
            color: activeTab === 'split' ? '#ffffff' : '#4b5563',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <span>⊞</span>
          <span>Side-by-Side (Unified)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('diagram')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            padding: '5px 8px',
            fontSize: '11px',
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
          <span>Database Flow</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stepper')}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            padding: '5px 8px',
            fontSize: '11px',
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

      {/* Query Subtitle */}
      <div style={{ marginBottom: '8px' }}>
        <h4 style={{ fontSize: '12.5px', fontWeight: '700', color: '#111827', margin: '0 0 2px 0' }}>
          {isStreaming ? 'Executing Neural Graph...' : (hasAnyEvents ? 'Execution Pipeline Complete' : 'Standby')}
        </h4>
        <p
          style={{
            fontSize: '11px',
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

      {/* Main Content Area */}
      {activeTab === 'split' ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px',
            alignItems: 'start'
          }}
        >
          {/* Left Column: Pipeline Stepper */}
          <div
            style={{
              background: '#fcfbf9',
              border: '1px solid #ebe8e1',
              borderRadius: '9px',
              padding: '10px 12px'
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#0e372d', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>≡</span>
              <span>Execution Pipeline Stages</span>
            </div>
            {renderStepper()}
          </div>

          {/* Right Column: Database & Gateway Topology with Moving Query Path */}
          <div
            style={{
              background: '#fcfbf9',
              border: '1px solid #ebe8e1',
              borderRadius: '9px',
              padding: '10px 12px'
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#0e372d', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>☊</span>
              <span>Active Database &amp; Gateway Topology Flow</span>
            </div>
            {renderDiagram()}
          </div>
        </div>
      ) : activeTab === 'diagram' ? (
        <div style={{ background: '#fcfbf9', border: '1px solid #ebe8e1', borderRadius: '9px', padding: '10px 12px' }}>
          {renderDiagram()}
        </div>
      ) : (
        <div style={{ background: '#fcfbf9', border: '1px solid #ebe8e1', borderRadius: '9px', padding: '10px 12px' }}>
          {renderStepper()}
        </div>
      )}

      {/* Styles for dynamic animations */}
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

        /* Animated Dash Lines */
        @keyframes flowDashes {
          from { stroke-dashoffset: 16; }
          to { stroke-dashoffset: 0; }
        }
        .animated-dash-line {
          animation: flowDashes 0.7s linear infinite;
        }

        /* Moving Query Packet Along Track */
        .connector-track {
          position: relative;
          height: 20px;
          display: flex;
          align-items: center;
          justifyContent: center;
          overflow: hidden;
        }

        @keyframes packetTravelVertical {
          0% {
            top: 0px;
            opacity: 0;
            transform: translate(-50%, 0) scale(0.8);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1.2);
          }
          80% {
            opacity: 1;
            transform: translate(-50%, 0) scale(1.2);
          }
          100% {
            top: 18px;
            opacity: 0;
            transform: translate(-50%, 0) scale(0.8);
          }
        }

        .moving-packet {
          position: absolute;
          left: 50%;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          box-shadow: 0 0 8px currentColor;
          animation: packetTravelVertical 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .moving-packet-branch {
          position: absolute;
          top: 10px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          box-shadow: 0 0 8px currentColor;
          animation: packetTravelVertical 1.1s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        /* Active Reached Node Pulse Effect */
        @keyframes activeBoxPulse {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4), 0 2px 6px rgba(16, 185, 129, 0.15);
            transform: translateY(0);
          }
          50% {
            box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.2), 0 4px 12px rgba(16, 185, 129, 0.25);
            transform: translateY(-1px);
          }
        }
        .active-node-box {
          animation: activeBoxPulse 1.8s ease-in-out infinite;
          position: relative;
        }
      `}</style>
    </div>
  );
}
