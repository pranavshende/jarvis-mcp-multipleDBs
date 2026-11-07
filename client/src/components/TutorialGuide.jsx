import React, { useState, useEffect } from 'react';

/**
 * TutorialGuide
 * Guided first-time visitor onboarding walkthrough for Jarvis AI Enterprise Platform.
 * - Explains the architecture, conversational canvas, deep reasoning, live data topology, and subviews.
 * - Includes a Skip button, step-by-step navigation, keyboard controls (Left/Right/Esc), and restart capability.
 */

const TUTORIAL_STEPS = [
  {
    step: 1,
    badge: 'ARCHITECTURE OVERVIEW',
    badgeColor: '#0e372d',
    badgeBg: '#e8f5ec',
    title: 'Welcome to Jarvis Enterprise Intelligence',
    subtitle: 'Unified AI intelligence layer for Meridian Supply Chain',
    icon: '🏢',
    content: (
      <div>
        <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', lineHeight: '1.6', color: '#374151' }}>
          Meridian Supply Chain operates across fragmented departmental systems: <strong>Seller DB</strong>, <strong>WMS (EWR1/ONT1)</strong>, <strong>Partner Portal</strong>, and <strong>QuickBooks AR Ledger</strong>.
        </p>
        <p style={{ margin: '0 0 14px 0', fontSize: '13.5px', lineHeight: '1.6', color: '#374151' }}>
          <strong>Jarvis</strong> unites these independent sources into one business-aware intelligence platform powered by Google Gemini, deterministic SQL, and enterprise pgvector RAG.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px', marginTop: '12px' }}>
          <div style={{ background: '#f8f7f4', border: '1px solid #e5e5e0', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '15px', marginBottom: '2px' }}>⚡</div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#111827' }}>Fastify Gateway</div>
            <div style={{ fontSize: '10px', color: '#6b7280' }}>&lt;15ms Semantic Cache</div>
          </div>
          <div style={{ background: '#f8f7f4', border: '1px solid #e5e5e0', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '15px', marginBottom: '2px' }}>🗄️</div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#111827' }}>PostgreSQL 17</div>
            <div style={{ fontSize: '10px', color: '#6b7280' }}>Star Schema Facts</div>
          </div>
          <div style={{ background: '#f8f7f4', border: '1px solid #e5e5e0', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '15px', marginBottom: '2px' }}>🧠</div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#111827' }}>pgvector HNSW</div>
            <div style={{ fontSize: '10px', color: '#6b7280' }}>746 SOP Chunks</div>
          </div>
          <div style={{ background: '#f8f7f4', border: '1px solid #e5e5e0', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ fontSize: '15px', marginBottom: '2px' }}>🤖</div>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#111827' }}>Gemini 2.5 Pro</div>
            <div style={{ fontSize: '10px', color: '#6b7280' }}>Grounded Synthesis</div>
          </div>
        </div>
      </div>
    )
  },
  {
    step: 2,
    badge: 'CONVERSATIONAL QUERIES',
    badgeColor: '#1d4ed8',
    badgeBg: '#eff6ff',
    title: 'Natural Language Intelligence & Starters',
    subtitle: 'Ask questions in plain English across all business domains',
    icon: '💬',
    content: (
      <div>
        <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', lineHeight: '1.6', color: '#374151' }}>
          You can interact with Jarvis conversationally without writing SQL queries or searching documents manually.
        </p>

        <div style={{ background: '#fdfbf7', border: '1px solid #f2ede4', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
          <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#0e372d', marginBottom: '6px' }}>
            Try queries like:
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#4b5563', lineHeight: '1.7' }}>
            <li><em>"What is our daily dock receiving summary across facilities?"</em></li>
            <li><em>"Why is Partner 301 on credit hold and what is their exposure?"</em></li>
            <li><em>"What are our official return grading and packaging inspection rules?"</em></li>
            <li><em>"Calculate FIFO inventory valuation and price inversion anomalies."</em></li>
          </ul>
        </div>

        <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '14px' }}>💡</span>
          <span><strong>Quick Tip:</strong> Click any of the 4 prompt starter cards on the canvas to trigger instant queries.</span>
        </div>
      </div>
    )
  },
  {
    step: 3,
    badge: 'PROMPT CONTROL & CANCELLATION',
    badgeColor: '#b45309',
    badgeBg: '#fef3c7',
    title: 'Edit Prompts & Stop Execution Mid-Way',
    subtitle: 'Full control over active reasoning and conversational flow',
    icon: '✎',
    content: (
      <div>
        <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', lineHeight: '1.6', color: '#374151' }}>
          Jarvis provides granular operational controls to refine, re-execute, or cancel generation at any moment:
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '10px', background: '#faf9f6', padding: '10px', borderRadius: '8px', border: '1px solid #ebe8e1' }}>
            <span style={{ fontSize: '18px' }}>✎</span>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#111827' }}>In-Place Prompt Rewriting</div>
              <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '2px' }}>
                Click the <strong>Edit</strong> button on any message to refine your inquiry. Jarvis cleanly rewinds chat context and re-executes.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', background: '#faf9f6', padding: '10px', borderRadius: '8px', border: '1px solid #ebe8e1' }}>
            <span style={{ fontSize: '18px' }}>⏹</span>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#dc2626' }}>Instant Mid-Way Stop</div>
              <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '2px' }}>
                Click the red <strong>[ ⏹ Stop ]</strong> button in the bottom bar or inside the workflow header to abort SSE streaming instantly.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', background: '#faf9f6', padding: '10px', borderRadius: '8px', border: '1px solid #ebe8e1' }}>
            <span style={{ fontSize: '18px' }}>⭘</span>
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#0e372d' }}>Deep Reasoning "Think" Mode</div>
              <div style={{ fontSize: '12px', color: '#4b5563', marginTop: '2px' }}>
                Toggle <strong>Think</strong> beside the input bar for deep chain-of-thought analysis on complex supply chain reconciliations.
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    step: 4,
    badge: 'DATA TOPOLOGY & FLOW',
    badgeColor: '#059669',
    badgeBg: '#d1fae5',
    title: 'Live Moving Database & Gateway Flow',
    subtitle: 'Full observability into where every number and citation originates',
    icon: '☊',
    content: (
      <div>
        <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', lineHeight: '1.6', color: '#374151' }}>
          Whenever Jarvis answers, the <strong>AI Workflow &amp; Data Topology</strong> card shows live telemetry side-by-side:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
          <div style={{ background: '#f0fdf4', border: '1.5px solid #10b981', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#065f46', marginBottom: '2px' }}>
              ≡ Pipeline Stepper
            </div>
            <div style={{ fontSize: '10px', color: '#047857', lineHeight: '1.4' }}>
              7 stages with millisecond timers showing intent detection, SQL execution, and citation checks.
            </div>
          </div>

          <div style={{ background: '#f0fdf4', border: '1.5px solid #10b981', borderRadius: '8px', padding: '10px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#065f46', marginBottom: '2px' }}>
              ☊ Topology Diagram
            </div>
            <div style={{ fontSize: '10px', color: '#047857', lineHeight: '1.4' }}>
              Animated query packets travel along connector tracks into PostgreSQL, pgvector, or Redis.
            </div>
          </div>
        </div>

        <div style={{ background: '#faf9f6', border: '1px solid #ebe8e1', borderRadius: '6px', padding: '8px 10px', fontSize: '11.5px', color: '#374151' }}>
          ✅ <strong>Success-Green Boxes:</strong> Every participating node and database lights up green with a verified checkmark upon completion!
        </div>
      </div>
    )
  },
  {
    step: 5,
    badge: 'OPERATIONAL MODULES',
    badgeColor: '#7c3aed',
    badgeBg: '#ede9fe',
    title: 'Explore Specialized Platform Subviews',
    subtitle: 'Access alerts, metrics, knowledge base & optimizer controls',
    icon: '🧭',
    content: (
      <div>
        <p style={{ margin: '0 0 12px 0', fontSize: '13.5px', lineHeight: '1.6', color: '#374151' }}>
          In addition to the conversational AI, you have full access to dedicated enterprise intelligence modules:
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e0', borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#dc2626' }}>🚨 Operational Alerts</div>
            <div style={{ fontSize: '9.5px', color: '#6b7280', marginTop: '1px' }}>Partner credit breach monitors &amp; human-gated holds</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e0', borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#2563eb' }}>📚 Knowledge Base</div>
            <div style={{ fontSize: '9.5px', color: '#6b7280', marginTop: '1px' }}>109 indexed documents &amp; 746 verified SOP chunks</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e0', borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#059669' }}>📊 Deterministic SQL</div>
            <div style={{ fontSize: '9.5px', color: '#6b7280', marginTop: '1px' }}>15 pre-compiled certified financial queries</div>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e0', borderRadius: '6px', padding: '8px 10px' }}>
            <div style={{ fontSize: '11.5px', fontWeight: '700', color: '#7c3aed' }}>⚡ Control Plane</div>
            <div style={{ fontSize: '9.5px', color: '#6b7280', marginTop: '1px' }}>MCP tokens, 50-scenario CI test center &amp; budgets</div>
          </div>
        </div>

        <p style={{ margin: '14px 0 0 0', fontSize: '12px', color: '#4b5563', lineHeight: '1.5' }}>
          Switch views anytime using the <strong>left sidebar navigation</strong> or the <strong>Operations Dashboard ↗</strong> button on the top bar.
        </p>
      </div>
    )
  }
];

export default function TutorialGuide({ isOpen, onClose }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Keyboard navigation: Left/Right arrows and Escape to exit
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        setCurrentStepIndex((prev) => (prev < TUTORIAL_STEPS.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStepIndex((prev) => (prev > 0 ? prev - 1 : prev));
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStep = TUTORIAL_STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === TUTORIAL_STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      handleComplete();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    try {
      localStorage.setItem('jarvis_tutorial_completed', 'true');
    } catch {}
    onClose();
  };

  const handleComplete = () => {
    try {
      localStorage.setItem('jarvis_tutorial_completed', 'true');
    } catch {}
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(17, 24, 39, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={handleSkip}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '560px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e5e0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderBottom: '1px solid #f0eee8',
            background: '#faf9f6'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '10.5px',
                fontWeight: '700',
                letterSpacing: '0.05em',
                background: currentStep.badgeBg,
                color: currentStep.badgeColor,
                padding: '3px 8px',
                borderRadius: '6px'
              }}
            >
              {currentStep.badge}
            </span>
            <span style={{ fontSize: '11.5px', color: '#6b7280', fontWeight: '500' }}>
              Step {currentStep.step} of {TUTORIAL_STEPS.length}
            </span>
          </div>

          {/* Skip Button */}
          <button
            type="button"
            onClick={handleSkip}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6b7280',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#111827')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
          >
            Skip Tutorial ✕
          </button>
        </div>

        {/* Step Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#f4f3ef',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                flexShrink: 0
              }}
            >
              {currentStep.icon}
            </div>
            <div>
              <h3 style={{ margin: '0 0 3px 0', fontSize: '17px', fontWeight: '700', color: '#111827' }}>
                {currentStep.title}
              </h3>
              <p style={{ margin: 0, fontSize: '12.5px', color: '#6b7280' }}>
                {currentStep.subtitle}
              </p>
            </div>
          </div>

          {currentStep.content}
        </div>

        {/* Footer Navigation */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid #f0eee8',
            background: '#faf9f6'
          }}
        >
          {/* Step Dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {TUTORIAL_STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                style={{
                  width: idx === currentStepIndex ? '20px' : '7px',
                  height: '7px',
                  borderRadius: '4px',
                  background: idx === currentStepIndex ? '#0e372d' : '#d1d5db',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {!isFirst && (
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  color: '#374151',
                  borderRadius: '8px',
                  padding: '7px 14px',
                  fontSize: '12.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                ← Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              style={{
                background: '#0e372d',
                border: 'none',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '7px 18px',
                fontSize: '12.5px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 6px rgba(14, 55, 45, 0.2)',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#0a2720')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#0e372d')}
            >
              <span>{isLast ? 'Get Started' : 'Next'}</span>
              <span>{isLast ? '🚀' : '→'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
