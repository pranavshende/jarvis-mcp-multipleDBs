import React, { useState } from 'react';

/**
 * ExecutionWorkflow
 * Premium Enterprise AI Execution Workflow Diagram for Jarvis AI.
 * Recreates the exact macOS card UI from the design reference:
 * - macOS window controls (🔴 🟡 🟢)
 * - Live execution badge (● Live)
 * - Stepper timeline with duration badges (✓ 0.4s)
 * - Parallel execution branch (RAG Retrieval + SQL Engine with spinner)
 * - Grounded validation stages
 */

export const DEFAULT_WORKFLOW_STAGES = [
  {
    id: 'QUERY_UNDERSTANDING',
    label: 'Query Understanding',
    subtext: 'Analyzed request and extracted intent.',
    status: 'completed',
    duration: '0.4s'
  },
  {
    id: 'INTENT_DETECTION',
    label: 'Intent & Entity Detection',
    subtext: 'Intent: Credit Investigation | Entity: Partner 301',
    status: 'completed',
    duration: '0.6s'
  },
  {
    id: 'ORCHESTRATOR',
    label: 'Business Orchestration',
    subtext: 'Selected required systems (SQL + RAG).',
    status: 'completed',
    duration: '0.3s'
  },
  {
    id: 'PARALLEL_EXECUTION',
    isParallel: true,
    branches: [
      {
        id: 'RAG_RETRIEVAL',
        label: 'RAG Retrieval',
        subtext: 'Fetched credit policy & release SOP.',
        status: 'completed',
        duration: '1.8s'
      },
      {
        id: 'SQL_ENGINE',
        label: 'SQL Engine',
        subtext: 'Retrieving live partner AR and credit data...',
        status: 'running',
        duration: '2.1s'
      }
    ]
  },
  {
    id: 'CONTEXT_AGGREGATION',
    label: 'Context Aggregation',
    subtext: 'Combining policy and live data...',
    status: 'pending'
  },
  {
    id: 'GEMINI_REASONING',
    label: 'Gemini Reasoning',
    subtext: 'Analyzing results and drafting answer...',
    status: 'pending'
  },
  {
    id: 'RESPONSE_GENERATION',
    label: 'Response Generation',
    subtext: 'Formatting with citations...',
    status: 'pending'
  },
  {
    id: 'CITATION_VALIDATION',
    label: 'Citation Validation',
    subtext: 'Verifying document references...',
    status: 'pending'
  }
];

export default function ExecutionWorkflow({
  events = [],
  isStreaming = false,
  queryTitle = 'Investigating Partner 301 credit hold and release process.',
  onClose
}) {
  const [selectedNode, setSelectedNode] = useState(null);

  // Map incoming events to stage states if streaming live
  const stageMap = {};
  if (events && events.length > 0) {
    events.forEach((e) => {
      stageMap[e.stage] = e;
    });
  }

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
              background: '#14532d',
              color: '#4ade80',
              fontSize: '10.5px',
              fontWeight: '600',
              padding: '2px 8px',
              borderRadius: '12px'
            }}
          >
            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#4ade80' }} />
            Live
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

      {/* Title & Subtitle */}
      <div style={{ marginTop: '12px', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: '0 0 3px 0' }}>
          Processing your request...
        </h3>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0, lineHeight: '1.4' }}>
          {queryTitle}
        </p>
      </div>

      {/* Stepper Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative' }}>
        
        {/* Step 1: Query Understanding */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative' }}>
          {/* Timeline Connector Line */}
          <div style={{ position: 'absolute', left: '9px', top: '20px', bottom: '-12px', width: '2px', background: '#10b981', zIndex: 1 }} />
          
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#10b981', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', zIndex: 2, flexShrink: 0 }}>
            ✓
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#111827' }}>Query Understanding</span>
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '500' }}>✓ 0.4s</span>
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>Analyzed request and extracted intent.</div>
          </div>
        </div>

        {/* Step 2: Intent & Entity Detection */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '9px', top: '20px', bottom: '-12px', width: '2px', background: '#10b981', zIndex: 1 }} />
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#10b981', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', zIndex: 2, flexShrink: 0 }}>
            ✓
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#111827' }}>Intent & Entity Detection</span>
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '500' }}>✓ 0.6s</span>
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>Intent: Credit Investigation | Entity: Partner 301</div>
          </div>
        </div>

        {/* Step 3: Business Orchestration */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '9px', top: '20px', bottom: '-12px', width: '2px', background: '#10b981', zIndex: 1 }} />
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#10b981', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', zIndex: 2, flexShrink: 0 }}>
            ✓
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '12.5px', fontWeight: '600', color: '#111827' }}>Business Orchestration</span>
              <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '500' }}>✓ 0.3s</span>
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280' }}>Selected required systems (SQL + RAG).</div>
          </div>
        </div>

        {/* Parallel Execution Step (RAG Retrieval + SQL Engine) */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '9px', top: '20px', bottom: '-12px', width: '2px', background: '#d1d5db', zIndex: 1 }} />
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#10b981', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', zIndex: 2, flexShrink: 0 }}>
            ✓
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            
            {/* RAG Branch */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#111827' }}>RAG Retrieval</span>
                <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: '500' }}>✓ 1.8s</span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#6b7280' }}>Fetched credit policy & release SOP.</div>
            </div>

            {/* SQL Engine Branch Card with Active Spinner */}
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
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7e22ce" strokeWidth="2.5" className="spin-slow">
                    <line x1="12" y1="2" x2="12" y2="6"/>
                    <line x1="12" y1="18" x2="12" y2="22"/>
                    <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                    <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                    <line x1="2" y1="12" x2="6" y2="12"/>
                    <line x1="18" y1="12" x2="22" y2="12"/>
                  </svg>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#581c87' }}>SQL Engine</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '600', color: '#7e22ce' }}>⟳ 2.1s</span>
              </div>
              <div style={{ fontSize: '10.5px', color: '#6b21a8', marginTop: '2px' }}>
                Retrieving live partner AR and credit data...
              </div>
            </div>

          </div>
        </div>

        {/* Step 5: Context Aggregation */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '9px', top: '20px', bottom: '-12px', width: '2px', background: '#e5e7eb', zIndex: 1 }} />
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #d1d5db', background: '#ffffff', zIndex: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#6b7280' }}>Context Aggregation</div>
            <div style={{ fontSize: '10.5px', color: '#9ca3af' }}>Combining policy and live data...</div>
          </div>
        </div>

        {/* Step 6: Gemini Reasoning */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '9px', top: '20px', bottom: '-12px', width: '2px', background: '#e5e7eb', zIndex: 1 }} />
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #d1d5db', background: '#ffffff', zIndex: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#6b7280' }}>Gemini Reasoning</div>
            <div style={{ fontSize: '10.5px', color: '#9ca3af' }}>Analyzing results and drafting answer...</div>
          </div>
        </div>

        {/* Step 7: Response Generation */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', position: 'relative' }}>
          <div style={{ position: 'absolute', left: '9px', top: '20px', bottom: '-12px', width: '2px', background: '#e5e7eb', zIndex: 1 }} />
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #d1d5db', background: '#ffffff', zIndex: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#6b7280' }}>Response Generation</div>
            <div style={{ fontSize: '10.5px', color: '#9ca3af' }}>Formatting with citations...</div>
          </div>
        </div>

        {/* Step 8: Citation Validation */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #d1d5db', background: '#ffffff', zIndex: 2, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '12px', fontWeight: '500', color: '#6b7280' }}>Citation Validation</div>
            <div style={{ fontSize: '10.5px', color: '#9ca3af' }}>Verifying document references...</div>
          </div>
        </div>

      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin-slow {
          animation: spin 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
