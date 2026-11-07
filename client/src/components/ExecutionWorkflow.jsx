import React, { useState } from 'react';

/**
 * ExecutionWorkflow
 * Premium Enterprise Glowing AI Execution Workflow Diagram for Jarvis v1.
 * Features:
 * - Real-time node-graph visualization of backend stages
 * - Glowing status states: Running (Electric Blue pulsing), Completed (Teal/Green), Skipped (Muted Gray), Failed (Red)
 * - Animated connection pathways between stages
 * - Parallel RAG Retrieval and SQL Engine branches
 * - Clickable node inspection drawer with inputs, outputs, entities, and timing
 * - Expandable / collapsible workflow view with compact telemetry bar
 */

const STAGE_CONFIGS = [
  {
    id: 'QUERY_UNDERSTANDING',
    label: 'Query Understanding',
    subtext: 'Gemini NLU Semantic Parsing',
    system: 'Google Gemini 3.5 Flash Lite',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    id: 'INTENT_DETECTION',
    label: 'Intent & Entity Extraction',
    subtext: 'Domain Intent & Entity State',
    system: 'Jarvis Memory & NLU Engine',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    ),
  },
  {
    id: 'ORCHESTRATOR',
    label: 'Intelligence Orchestrator',
    subtext: 'Dynamic Execution Plan',
    system: 'Fastify Gateway Intent Router',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    ),
  },
  {
    id: 'RAG_RETRIEVAL',
    label: 'RAG Knowledge Retrieval',
    subtext: 'Hybrid pgvector + BM25 Search',
    system: 'Flask RAG & pgvector Store',
    branch: 'rag',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    id: 'SQL_ENGINE',
    label: 'SQL Metrics Engine',
    subtext: 'Certified Database Execution',
    system: 'Supabase PostgreSQL 17',
    branch: 'sql',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
      </svg>
    ),
  },
  {
    id: 'CONTEXT_AGGREGATION',
    label: 'Context Aggregation',
    subtext: 'Evidence & Policy Synthesis',
    system: 'Jarvis Dual-Synthesis Pipeline',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: 'GEMINI_REASONING',
    label: 'Gemini Deep Reasoning',
    subtext: 'Root Cause & Grounded Analysis',
    system: 'Google Gemini 3.5 Flash',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 3v3" />
        <path d="M12 18v3" />
        <path d="M3 12h3" />
        <path d="M18 12h3" />
      </svg>
    ),
  },
  {
    id: 'CITATION_VALIDATION',
    label: 'Citation Validation',
    subtext: 'Zero-Hallucination Source Check',
    system: 'Knowledge Governance Tier 1',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    id: 'FINAL_RESPONSE',
    label: 'Final Response Delivery',
    subtext: 'Structured Enterprise Report',
    system: 'Fastify Gateway Transport',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
];

export default function ExecutionWorkflow({ events = [], isStreaming = false, defaultExpanded = true }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedNode, setSelectedNode] = useState(null);

  // Group events by stage to determine current status and telemetry
  const stageStatusMap = {};
  for (const evt of events) {
    stageStatusMap[evt.stage] = evt;
  }

  // Derive execution telemetry
  const completedCount = events.filter((e) => e.status === 'completed').length;
  const runningEvent = events.find((e) => e.status === 'running');
  const isFailed = events.some((e) => e.status === 'failed');

  // Find total duration from final event or sum
  const finalEvent = stageStatusMap['FINAL_RESPONSE'];
  const totalDurationMs = finalEvent?.durationMs || events.reduce((acc, curr) => acc + (curr.durationMs || 0), 0);

  // Compact one-line summary
  const getCompactSummary = () => {
    if (runningEvent) {
      return (
        <span style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span className="live-pulsing-dot" />
          <span>{runningEvent.message || `Processing ${runningEvent.stage}...`}</span>
        </span>
      );
    }
    if (finalEvent && finalEvent.metadata?.fromCache) {
      return (
        <span style={{ color: '#34d399' }}>
          ⚡ Served from Composite Semantic Cache in {totalDurationMs ? `${totalDurationMs.toFixed(1)}ms` : '< 15ms'}
        </span>
      );
    }
    const tools = events
      .filter((e) => e.metadata?.tool || e.metadata?.metricId)
      .map((e) => e.metadata?.tool || e.metadata?.metricId);
    const citeCount = events.find((e) => e.metadata?.citationsCount)?.metadata?.citationsCount || 0;

    return (
      <span style={{ color: '#9ca3af' }}>
        Verified via Gemini NLU {tools.length > 0 ? `• Tool: ${tools[0]}` : ''}{' '}
        {citeCount > 0 ? `• ${citeCount} certified citations` : ''} • {totalDurationMs ? `${(totalDurationMs / 1000).toFixed(2)}s` : 'Done'}
      </span>
    );
  };

  return (
    <div
      style={{
        margin: '12px 0 16px 0',
        borderRadius: '12px',
        background: '#121214',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
        overflow: 'hidden',
        fontSize: '12px',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '9px 14px',
          background: '#17171a',
          borderBottom: isExpanded ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
          cursor: 'pointer',
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Animated Glowing Pill Indicator */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '18px',
              height: '18px',
              borderRadius: '50%',
              background: runningEvent ? 'rgba(59, 130, 246, 0.25)' : isFailed ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.2)',
              color: runningEvent ? '#60a5fa' : isFailed ? '#f87171' : '#34d399',
              boxShadow: runningEvent ? '0 0 10px rgba(59, 130, 246, 0.6)' : 'none',
            }}
          >
            {runningEvent ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin-slow">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            ) : isFailed ? (
              '!'
            ) : (
              '✓'
            )}
          </span>

          <span style={{ fontWeight: '600', color: '#f3f4f6', letterSpacing: '0.02em' }}>
            Live AI Execution Workflow
          </span>

          {/* Compact summary when collapsed */}
          {!isExpanded && <span style={{ marginLeft: '6px', fontSize: '11.5px' }}>{getCompactSummary()}</span>}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {totalDurationMs > 0 && (
            <span
              style={{
                fontSize: '11px',
                color: '#9ca3af',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '2px 7px',
                borderRadius: '4px',
              }}
            >
              ⏱️ {(totalDurationMs / 1000).toFixed(2)}s
            </span>
          )}

          <button
            style={{
              background: 'transparent',
              border: 'none',
              color: '#9ca3af',
              fontSize: '11px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
            }}
          >
            <span>{isExpanded ? 'Hide' : 'Inspect'}</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Interactive Workflow Diagram */}
      {isExpanded && (
        <div style={{ padding: '14px 16px 12px', background: '#0e0e10', position: 'relative' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {STAGE_CONFIGS.map((cfg, idx) => {
              const evt = stageStatusMap[cfg.id];
              const status = evt?.status || (runningEvent ? 'pending' : 'skipped');
              const isSelected = selectedNode?.id === cfg.id;

              // Determine Glowing Styles based on exact state
              let glowBorder = '1px solid rgba(255, 255, 255, 0.06)';
              let glowBg = '#141417';
              let badgeColor = '#6b7280';
              let badgeBg = 'rgba(107, 114, 128, 0.15)';
              let iconColor = '#9ca3af';

              if (status === 'completed') {
                glowBorder = '1px solid rgba(16, 185, 129, 0.35)';
                glowBg = 'rgba(16, 185, 129, 0.04)';
                badgeColor = '#34d399';
                badgeBg = 'rgba(16, 185, 129, 0.15)';
                iconColor = '#10b981';
              } else if (status === 'running') {
                glowBorder = '1px solid #3b82f6';
                glowBg = 'rgba(59, 130, 246, 0.1)';
                badgeColor = '#60a5fa';
                badgeBg = 'rgba(59, 130, 246, 0.2)';
                iconColor = '#3b82f6';
              } else if (status === 'failed') {
                glowBorder = '1px solid #ef4444';
                glowBg = 'rgba(239, 68, 68, 0.1)';
                badgeColor = '#f87171';
                badgeBg = 'rgba(239, 68, 68, 0.2)';
                iconColor = '#ef4444';
              } else if (status === 'skipped') {
                glowBg = '#121214';
                badgeColor = '#4b5563';
                badgeBg = 'rgba(75, 85, 99, 0.15)';
              }

              return (
                <div key={cfg.id} style={{ position: 'relative' }}>
                  {/* Subtle connecting vertical line */}
                  {idx < STAGE_CONFIGS.length - 1 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: '21px',
                        top: '32px',
                        bottom: '-10px',
                        width: '2px',
                        background:
                          status === 'completed'
                            ? 'rgba(16, 185, 129, 0.35)'
                            : status === 'running'
                            ? '#3b82f6'
                            : 'rgba(255, 255, 255, 0.08)',
                        zIndex: 1,
                      }}
                    />
                  )}

                  {/* Stage Node Item */}
                  <div
                    onClick={() => setSelectedNode(isSelected ? null : { ...cfg, event: evt })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: glowBg,
                      border: isSelected ? '1px solid #60a5fa' : glowBorder,
                      boxShadow: status === 'running' ? '0 0 12px rgba(59, 130, 246, 0.35)' : 'none',
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      position: 'relative',
                      zIndex: 2,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = glowBorder.split(' ')[2];
                    }}
                  >
                    {/* Left: Icon + Labels */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '6px',
                          background: '#1c1c20',
                          border: `1px solid ${status === 'running' ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: iconColor,
                          flexShrink: 0,
                        }}
                      >
                        {cfg.icon}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: '600', color: status === 'skipped' ? '#6b7280' : '#f3f4f6', fontSize: '12.5px' }}>
                            {cfg.label}
                          </span>
                          {cfg.branch && (
                            <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(255, 255, 255, 0.06)', color: '#9ca3af', textTransform: 'uppercase' }}>
                              {cfg.branch}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '11px', color: '#71717a' }}>
                          {evt?.message || cfg.subtext}
                        </div>
                      </div>
                    </div>

                    {/* Right: Status Pill + Duration */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {evt?.durationMs !== undefined && (
                        <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: 'monospace' }}>
                          {evt.durationMs < 1000 ? `${Math.round(evt.durationMs)}ms` : `${(evt.durationMs / 1000).toFixed(2)}s`}
                        </span>
                      )}

                      <span
                        style={{
                          fontSize: '10px',
                          padding: '2px 7px',
                          borderRadius: '4px',
                          background: badgeBg,
                          color: badgeColor,
                          fontWeight: '600',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {status === 'running' && <span className="live-pulsing-dot" />}
                        {status}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Inspection Drawer for selected node */}
          {selectedNode && (
            <div
              style={{
                marginTop: '14px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#17171a',
                border: '1px solid rgba(59, 130, 246, 0.35)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: '600', color: '#ffffff', fontSize: '13px' }}>
                    {selectedNode.label} Inspection
                  </span>
                  <span style={{ fontSize: '10.5px', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.15)', padding: '1px 6px', borderRadius: '4px' }}>
                    {selectedNode.system}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedNode(null)}
                  style={{ background: 'transparent', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '14px' }}
                >
                  ✕
                </button>
              </div>

              <div style={{ fontSize: '11.5px', color: '#d1d5db', lineHeight: '1.5' }}>
                <div><strong>Status:</strong> {selectedNode.event?.status || 'skipped'}</div>
                {selectedNode.event?.durationMs !== undefined && (
                  <div><strong>Execution Time:</strong> {selectedNode.event.durationMs} ms</div>
                )}
                {selectedNode.event?.message && (
                  <div><strong>Telemetry:</strong> {selectedNode.event.message}</div>
                )}
                {selectedNode.event?.metadata && (
                  <div style={{ marginTop: '6px' }}>
                    <strong>Metadata:</strong>
                    <pre
                      style={{
                        margin: '4px 0 0 0',
                        padding: '8px 10px',
                        background: '#101012',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: '#38bdf8',
                        fontFamily: 'monospace',
                        overflowX: 'auto',
                      }}
                    >
                      {JSON.stringify(selectedNode.event.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Embedded CSS for pulsing glow and spin animations */}
      <style>{`
        @keyframes pulseGlow {
          0% { box-shadow: 0 0 6px rgba(59, 130, 246, 0.4); opacity: 0.8; }
          50% { box-shadow: 0 0 16px rgba(59, 130, 246, 0.9); opacity: 1; }
          100% { box-shadow: 0 0 6px rgba(59, 130, 246, 0.4); opacity: 0.8; }
        }
        .live-pulsing-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #3b82f6;
          animation: pulseGlow 1.2s infinite ease-in-out;
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-slow {
          animation: spinSlow 2.5s linear infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

