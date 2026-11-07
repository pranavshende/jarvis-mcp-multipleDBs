import React, { useState, useEffect } from 'react';

/**
 * ExecutionWorkflow
 * 100% Dynamic Enterprise AI Execution Workflow Diagram for Jarvis AI.
 * - Integrated directly inside chat messages or available docked
 * - Glowing active stage animation
 * - Completed, Running, Failed, and Skipped states
 * - Real backend execution duration and metadata
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
  onClose
}) {
  const [isExpanded, setIsExpanded] = useState(isStreaming);

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
            AI Execution Complete
          </span>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>
            ({completedStagesCount} stages verified)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#0e372d', fontWeight: '600' }}>
          <span>View Telemetry</span>
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
        maxWidth: inline ? '100%' : '360px',
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
            AI EXECUTION WORKFLOW
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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

      {/* Subtitle / Active Query */}
      <div style={{ marginTop: '10px', marginBottom: '12px' }}>
        <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: '#111827', margin: '0 0 2px 0' }}>
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

      {/* Stepper Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
        {WORKFLOW_PIPELINE.map((stage, sIdx) => {
          // If parallel execution fork (RAG + SQL)
          if (stage.isFork) {
            const ragState = getStageState('RAG_RETRIEVAL');
            const sqlState = getStageState('SQL_ENGINE');
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
                        RAG Retrieval
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
                          <span style={{ fontSize: '11.5px', fontWeight: '600', color: '#581c87' }}>SQL Engine</span>
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
                          SQL Engine
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
