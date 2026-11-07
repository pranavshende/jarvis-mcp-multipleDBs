import React, { useState, useEffect, useRef } from 'react';

/**
 * TutorialGuide
 * Interactive Spotlight Walkthrough that takes the user directly to each button on the page.
 * 
 * Features:
 * - Dynamic spotlight cutout box positioned over the target button using getBoundingClientRect()
 * - Floating tooltip card anchored to the button with directional pointer arrow
 * - Auto-scrolls elements into view
 * - Auto-opens sidebar if the target button is inside the sidebar
 * - Skip Tour button, step dots, and full keyboard navigation (Arrows / Escape)
 */

const TOUR_STEPS = [
  {
    target: '[data-tour="new-chat-btn"]',
    title: '+ New Chat Button',
    badge: 'SESSION MANAGEMENT',
    badgeColor: '#0e372d',
    badgeBg: '#e8f5ec',
    icon: '✨',
    preferredPlacement: 'right',
    requiresSidebar: true,
    description: (
      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.5', color: '#374151' }}>
          Starts a fresh conversation session. Your ongoing questions stay grouped together in isolated multi-turn threads rather than fragmenting into separate records.
        </p>
        <div style={{ fontSize: '11.5px', color: '#0e372d', background: '#f0fdf4', padding: '6px 8px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
          💡 <strong>Tip:</strong> Use a new chat whenever you switch business topics (e.g. moving from warehouse dock receiving to wholesale partner credit lines).
        </div>
      </div>
    )
  },
  {
    target: '[data-tour="recent-chats"]',
    title: 'Recents & Session History',
    badge: 'POSTGRESQL CONTINUITY',
    badgeColor: '#1d4ed8',
    badgeBg: '#eff6ff',
    icon: '💬',
    preferredPlacement: 'right',
    requiresSidebar: true,
    description: (
      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.5', color: '#374151' }}>
          All your historical multi-turn chat sessions are persisted here in Supabase PostgreSQL 17.
        </p>
        <ul style={{ margin: '0 0 8px 0', paddingLeft: '16px', fontSize: '12px', color: '#4b5563', lineHeight: '1.6' }}>
          <li>Click any session to restore its messages, citations, and execution telemetry.</li>
          <li>Click <strong>✎</strong> to rename a thread or <strong>✕</strong> to archive/delete it.</li>
        </ul>
      </div>
    )
  },
  {
    target: '[data-tour="sidebar-modules"]',
    title: 'Enterprise Intelligence Modules',
    badge: 'SYSTEM NAVIGATION',
    badgeColor: '#7c3aed',
    badgeBg: '#ede9fe',
    icon: '🏢',
    preferredPlacement: 'right',
    requiresSidebar: true,
    description: (
      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.5', color: '#374151' }}>
          Switch between the conversational chat and specialized supply chain engines:
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px' }}>
          <div style={{ background: '#f8f7f4', padding: '5px 7px', borderRadius: '5px' }}>
            <strong>🚨 Alert Center:</strong> Credit breach monitors
          </div>
          <div style={{ background: '#f8f7f4', padding: '5px 7px', borderRadius: '5px' }}>
            <strong>📊 SQL Metrics:</strong> 15 deterministic queries
          </div>
          <div style={{ background: '#f8f7f4', padding: '5px 7px', borderRadius: '5px' }}>
            <strong>📚 Library:</strong> 746 verified SOP chunks
          </div>
          <div style={{ background: '#f8f7f4', padding: '5px 7px', borderRadius: '5px' }}>
            <strong>⚡ MCP Admin:</strong> Tool tokens &amp; budgets
          </div>
        </div>
      </div>
    )
  },
  {
    target: '[data-tour="model-selector"]',
    title: 'AI Model Selector',
    badge: 'DYNAMIC ROUTING',
    badgeColor: '#059669',
    badgeBg: '#d1fae5',
    icon: '🤖',
    preferredPlacement: 'bottom',
    description: (
      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.5', color: '#374151' }}>
          Choose the Gemini reasoning tier that fits your objective:
        </p>
        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#4b5563', lineHeight: '1.6' }}>
          <li><strong>gemini-2.5-pro:</strong> Deep multi-step reasoning, root cause analysis, and strict citation grounding.</li>
          <li><strong>gemini-2.5-flash:</strong> Fast conversational responses and rapid operational lookups.</li>
        </ul>
      </div>
    )
  },
  {
    target: '[data-tour="ops-dashboard-btn"]',
    title: 'Operations Dashboard Button',
    badge: 'EXECUTIVE OVERVIEW',
    badgeColor: '#18181b',
    badgeBg: '#f4f4f5',
    icon: '↗',
    preferredPlacement: 'bottom',
    description: (
      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.5', color: '#374151' }}>
          Toggles the executive <strong>Founder Ground Truth</strong> overview.
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: '#4b5563', lineHeight: '1.5' }}>
          Gives enterprise leadership a unified panoramic view of dock-to-stock throughput, live warehouse intake charts (EWR1/ONT1), and QuickBooks AR balance aging.
        </p>
      </div>
    )
  },
  {
    target: '[data-tour="tour-btn"]',
    title: 'Tutorial Tour Restart Button',
    badge: 'ON-DEMAND REFRESHER',
    badgeColor: '#0e372d',
    badgeBg: '#e8f5ec',
    icon: '🎓',
    preferredPlacement: 'bottom',
    description: (
      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.5', color: '#374151' }}>
          You can click this <strong>🎓 Tutorial Tour</strong> button at any time in the future to restart this interactive spotlight walkthrough and review any button.
        </p>
      </div>
    )
  },
  {
    target: '[data-tour="starter-prompts"]',
    title: 'Starter Query Cards',
    badge: 'ONE-CLICK DISPATCH',
    badgeColor: '#2563eb',
    badgeBg: '#eff6ff',
    icon: '⚡',
    preferredPlacement: 'top',
    description: (
      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.5', color: '#374151' }}>
          Pre-compiled operational queries designed to immediately test the platform's multi-system intelligence:
        </p>
        <div style={{ fontSize: '11.5px', color: '#4b5563', background: '#fdfbf7', padding: '6px 8px', borderRadius: '6px', border: '1px solid #f2ede4' }}>
          Click any card to trigger an automated Dual-Synthesis that queries PostgreSQL 17 and pgvector RAG simultaneously.
        </div>
      </div>
    )
  },
  {
    target: '[data-tour="think-toggle"]',
    title: 'Deep Reasoning "Think" Toggle',
    badge: 'CHAIN-OF-THOUGHT',
    badgeColor: '#0e372d',
    badgeBg: '#e8f5ec',
    icon: '⭘',
    preferredPlacement: 'top',
    description: (
      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.5', color: '#374151' }}>
          Click to activate or deactivate Gemini's <strong>Deep Think</strong> mode.
        </p>
        <p style={{ margin: 0, fontSize: '12px', color: '#4b5563', lineHeight: '1.5' }}>
          When active, Jarvis reveals its internal reasoning graph and performs cross-departmental reconciliation before outputting the final business synthesis.
        </p>
      </div>
    )
  },
  {
    target: '[data-tour="send-stop-btn"]',
    title: 'Send & Stop Execution Button',
    badge: 'EXECUTION CONTROLLER',
    badgeColor: '#dc2626',
    badgeBg: '#fee2e2',
    icon: '⏹',
    preferredPlacement: 'top',
    description: (
      <div>
        <p style={{ margin: '0 0 8px 0', fontSize: '13px', lineHeight: '1.5', color: '#374151' }}>
          Dual-purpose execution controller:
        </p>
        <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#4b5563', lineHeight: '1.6' }}>
          <li><strong>When idle (Dark Green ↑):</strong> Submits your query (or press Enter).</li>
          <li><strong>When running (Red ⏹):</strong> Immediately aborts active AI generation and cancels the SSE stream mid-way!</li>
        </ul>
      </div>
    )
  }
];

export default function TutorialGuide({ isOpen, onClose, onEnsureSidebarOpen }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const resizeObserverRef = useRef(null);

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === TOUR_STEPS.length - 1;

  // Measure and position spotlight around target element
  const updateTargetPosition = () => {
    if (!isOpen || !currentStep) return;

    if (currentStep.requiresSidebar && onEnsureSidebarOpen) {
      onEnsureSidebarOpen();
    }

    setTimeout(() => {
      const el = document.querySelector(currentStep.target);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        const rect = el.getBoundingClientRect();
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom,
          right: rect.right
        });
      } else {
        // If element not currently visible on DOM, center tooltip
        setTargetRect(null);
      }
    }, 60);
  };

  useEffect(() => {
    if (!isOpen) {
      setTargetRect(null);
      return;
    }
    updateTargetPosition();

    const handleResize = () => updateTargetPosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen, currentStepIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex]);

  if (!isOpen) return null;

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

  // Compute tooltip position relative to spotlight target
  const getTooltipPosition = () => {
    if (!targetRect) {
      // Centered fallback
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        arrow: null
      };
    }

    const margin = 14;
    const tooltipWidth = 360;
    const tooltipHeight = 260;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let placement = currentStep.preferredPlacement || 'bottom';

    // Auto-adjust if offscreen
    if (placement === 'right' && targetRect.right + tooltipWidth + margin > viewportWidth) {
      placement = targetRect.left - tooltipWidth - margin > 0 ? 'left' : 'bottom';
    }
    if (placement === 'bottom' && targetRect.bottom + tooltipHeight + margin > viewportHeight) {
      placement = 'top';
    }
    if (placement === 'top' && targetRect.top - tooltipHeight - margin < 0) {
      placement = 'bottom';
    }

    if (placement === 'right') {
      return {
        position: 'fixed',
        top: Math.max(16, Math.min(viewportHeight - tooltipHeight - 16, targetRect.top + targetRect.height / 2 - 80)),
        left: targetRect.right + margin,
        arrow: 'left'
      };
    }
    if (placement === 'left') {
      return {
        position: 'fixed',
        top: Math.max(16, Math.min(viewportHeight - tooltipHeight - 16, targetRect.top + targetRect.height / 2 - 80)),
        left: Math.max(16, targetRect.left - tooltipWidth - margin),
        arrow: 'right'
      };
    }
    if (placement === 'top') {
      return {
        position: 'fixed',
        top: Math.max(16, targetRect.top - tooltipHeight - margin),
        left: Math.max(16, Math.min(viewportWidth - tooltipWidth - 16, targetRect.left + targetRect.width / 2 - tooltipWidth / 2)),
        arrow: 'bottom'
      };
    }
    // Default bottom
    return {
      position: 'fixed',
      top: Math.min(viewportHeight - tooltipHeight - 16, targetRect.bottom + margin),
      left: Math.max(16, Math.min(viewportWidth - tooltipWidth - 16, targetRect.left + targetRect.width / 2 - tooltipWidth / 2)),
      arrow: 'top'
    };
  };

  const tooltipPos = getTooltipPosition();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        pointerEvents: 'auto'
      }}
    >
      {/* Dark Overlay (clicks outside skip/close) */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: targetRect ? 'transparent' : 'rgba(15, 23, 42, 0.65)',
          backdropFilter: targetRect ? 'none' : 'blur(3px)',
          transition: 'all 0.3s ease'
        }}
        onClick={handleSkip}
      />

      {/* Spotlight Cutout around the specific button */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            top: targetRect.top - 6,
            left: targetRect.left - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            borderRadius: '9px',
            border: '3px solid #10b981',
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72), 0 0 20px rgba(16, 185, 129, 0.65)',
            pointerEvents: 'none',
            zIndex: 100000,
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          {/* Animated Target Beacon Ring */}
          <div
            style={{
              position: 'absolute',
              inset: '-8px',
              border: '2px solid #10b981',
              borderRadius: '13px',
              animation: 'tourBeacon 1.6s infinite ease-out',
              pointerEvents: 'none'
            }}
          />
        </div>
      )}

      {/* Floating Explanation Tooltip Card */}
      <div
        style={{
          ...tooltipPos,
          width: '100%',
          maxWidth: '380px',
          background: '#ffffff',
          borderRadius: '14px',
          boxShadow: '0 16px 36px rgba(0, 0, 0, 0.28), 0 2px 8px rgba(0, 0, 0, 0.1)',
          border: '1.5px solid #10b981',
          zIndex: 100001,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'tourCardFadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          transition: 'top 0.3s ease, left 0.3s ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tooltip Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            background: '#faf9f6',
            borderBottom: '1px solid #f0eee8'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '700',
                letterSpacing: '0.04em',
                background: currentStep.badgeBg,
                color: currentStep.badgeColor,
                padding: '2px 7px',
                borderRadius: '5px'
              }}
            >
              {currentStep.badge}
            </span>
            <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>
              Step {currentStepIndex + 1} of {TOUR_STEPS.length}
            </span>
          </div>

          <button
            type="button"
            onClick={handleSkip}
            title="Skip guided tour"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#6b7280',
              fontSize: '11.5px',
              fontWeight: '600',
              cursor: 'pointer',
              padding: '2px 6px',
              borderRadius: '4px'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#111827')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
          >
            Skip ✕
          </button>
        </div>

        {/* Tooltip Body */}
        <div style={{ padding: '16px 18px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '18px' }}>{currentStep.icon}</span>
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#111827' }}>
              {currentStep.title}
            </h4>
          </div>

          {currentStep.description}
        </div>

        {/* Tooltip Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: '#faf9f6',
            borderTop: '1px solid #f0eee8'
          }}
        >
          {/* Step Dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            {TOUR_STEPS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                style={{
                  width: idx === currentStepIndex ? '16px' : '6px',
                  height: '6px',
                  borderRadius: '3px',
                  background: idx === currentStepIndex ? '#10b981' : '#d1d5db',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title={`Jump to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {!isFirst && (
              <button
                type="button"
                onClick={handlePrev}
                style={{
                  background: '#ffffff',
                  border: '1px solid #d1d5db',
                  color: '#374151',
                  borderRadius: '6px',
                  padding: '5px 10px',
                  fontSize: '11.5px',
                  fontWeight: '600',
                  cursor: 'pointer'
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
                borderRadius: '6px',
                padding: '5px 14px',
                fontSize: '11.5px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 5px rgba(14, 55, 45, 0.2)'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#0a2720')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#0e372d')}
            >
              <span>{isLast ? 'Got it' : 'Next'}</span>
              <span>{isLast ? '🚀' : '→'}</span>
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes tourBeacon {
          0% { transform: scale(0.96); opacity: 0.9; }
          50% { transform: scale(1.08); opacity: 0.3; }
          100% { transform: scale(0.96); opacity: 0.9; }
        }
        @keyframes tourCardFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
