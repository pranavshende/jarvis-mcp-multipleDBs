import React, { useState } from 'react';

/**
 * ExecutionWorkflow
 * 100% Dynamic Enterprise AI Execution Workflow Diagram for Jarvis AI.
 * Driven entirely by real execution events emitted from the Gateway SSE stream.
 * - Dynamic pipeline stages mapped to live backend events
 * - Real execution timings (durationMs)
 * - Dynamic status states: Running (animated spinner), Completed (✓), Skipped (—), Failed (✕)
 * - Parallel execution fork (RAG Retrieval + SQL Engine)
 * - Real user query displayed in the subtitle
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
  queryTitle = 'Awaiting input query...',
  onClose
}) {
  const [selectedNode, setSelectedNode] = useState(null);

  // Index events by stage for fast lookup
  const eventMap = {};
  if (Array.isArray(events)) {
    events.forEach((e) => {
      if (e && e.stage) {
        eventMap[e.stage] = e;
      }
    });
  }

  // Helper to format duration dynamically
  const formatDuration = (ms) => {
    if (ms === undefined || ms === null) return '';
    if (ms < 100) return '<0.1s';
    if (ms < 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  // Helper to resolve stage status dynamically
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
    // If no event yet:
    if (isStreaming) {
      return { status: 'pending', message: 'Queued in execution pipeline', duration: '' };
    }
    return { status: 'skipped', message: 'Stage not required for this query', duration: '' };
  };

  const hasAnyEvents = events && events.length > 0;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '360px',
        background: '#ffffff',
        border: '1px solid #e5e5e0',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
        padding: '16px',
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}
    >
      {/* Mac Window Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f3f4f6' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span style={{ fontSize: '11px', fontWeight: '700', color: '#374151', letterSpacing: '0.05em', marginLeft: '6px' }}>
            AI EXECUTION WORKFLOW
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
            {isStreaming && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80' }} />}
            {isStreaming ? 'Live' : 'Verified'}
          </span>

          {onClose && (
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', padding: '2px', fontSize: '12px' }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Title & Subtitle from user query */}
      <div style={{ marginTop: '12px', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: '0 0 3px 0' }}>
          {isStreaming ? 'Processing your request...' : (hasAnyEvents ? 'Execution Complete' : 'Standby')}
        </h3>
        <p
          style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: 0,
            lineHeight: '1.4',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical'
          }}
        >
          {queryTitle}
        </p>
      </div>

      {/* Dynamic Stepper Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
        
        {WORKFLOW_PIPELINE.map((stage, sIdx) => {
          // If parallel execution fork
          if (stage.isFork) {
            const ragState = getStageState('RAG_RETRIEVAL');
            const sqlState = getStageState('SQL_ENGINE');
            const isForkActive = ragState.status === 'running' || sqlState.status === 'running';
            const isForkDone = ragState.status === 'completed' || sqlState.status === 'completed';

            return (
              <div key={stage.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative' }}>
                {sIdx < WORKFLOW_PIPELINE.length - 1 && (
                  <div style={{ position: 'absolute', left: '9px', top: '20px', bottom: '-12px', width: '2px', background: isForkDone ? '#10b981' : '#e5e7eb', zIndex: 1 }} />
                )}

                {/* Node Status Circle */}
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: isForkDone ? '#10b981' : isForkActive ? '#3b82f6' : '#ffffff',
                    border: isForkDone || isForkActive ? 'none' : '2px solid #d1d5db',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    zIndex: 2,
                    flexShrink: 0
                  }}
                >
                  {isForkDone ? '✓' : isForkActive ? '⟳' : ''}
                </div>

                {/* Fork Branches Container */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  
                  {/* RAG Retrieval Branch */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: ragState.status === 'skipped' ? '#9ca3af' : '#111827' }}>
                        RAG Retrieval
                      </span>
                      {ragState.duration && (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '500' }}>✓ {ragState.duration}</span>
                      )}
                      {ragState.status === 'skipped' && (
                        <span style={{ fontSize: '10px', color: '#9ca3af', fontStyle: 'italic' }}>— Skipped</span>
                      )}
                    </div>
                    <div style={{ fontSize: '10.5px', color: '#6b7280' }}>
                      {ragState.message || 'Searching certified operational knowledge chunks'}
                    </div>
                  </div>

                  {/* SQL Engine Branch */}
                  {sqlState.status === 'running' ? (
                    <div
                      style={{
                        background: '#faf5ff',
                        border: '1px solid #c084fc',
                        borderRadius: '8px',
                        padding: '8px 10px',
                        marginTop: '2px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span className="spin-slow" style={{ display: 'inline-block', color: '#7e22ce', fontSize: '12px' }}>⟳</span>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#581c87' }}>SQL Engine</span>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#7e22ce' }}>Active</span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#6b21a8', marginTop: '2px' }}>
                        {sqlState.message || 'Executing live SQL metric query'}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: sqlState.status === 'skipped' ? '#9ca3af' : '#111827' }}>
                          SQL Engine
                        </span>
                        {sqlState.duration && (
                          <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '500' }}>✓ {sqlState.duration}</span>
                        )}
                        {sqlState.status === 'skipped' && (
                          <span style={{ fontSize: '10px', color: '#9ca3af', fontStyle: 'italic' }}>— Skipped</span>
                        )}
                      </div>
                      <div style={{ fontSize: '10.5px', color: '#6b7280' }}>
                        {sqlState.message || 'Executing deterministic database metrics'}
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
              {/* Connector line */}
              {sIdx < WORKFLOW_PIPELINE.length - 1 && (
                <div
                  style={{
                    position: 'absolute',
                    left: '9px',
                    top: '20px',
                    bottom: '-12px',
                    width: '2px',
                    background: isDone ? '#10b981' : isRunning ? '#3b82f6' : '#e5e7eb',
                    zIndex: 1
                  }}
                />
              )}

              {/* Status Circle */}
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: isDone ? '#10b981' : isRunning ? '#3b82f6' : isFailed ? '#ef4444' : '#ffffff',
                  border: isDone || isRunning || isFailed ? 'none' : '2px solid #d1d5db',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
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
                  <span style={{ fontSize: '12.5px', fontWeight: '600', color: isSkipped ? '#9ca3af' : '#111827' }}>
                    {stage.label}
                  </span>
                  {state.duration && isDone && (
                    <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '500' }}>✓ {state.duration}</span>
                  )}
                  {isRunning && (
                    <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: '600' }} className="spin-slow">⟳</span>
                  )}
                  {isSkipped && (
                    <span style={{ fontSize: '10.5px', color: '#9ca3af', fontStyle: 'italic' }}>— Skipped</span>
                  )}
                </div>
                <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '1px' }}>
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
          animation: spin 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
}
