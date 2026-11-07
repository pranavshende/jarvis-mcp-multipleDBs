import React, { useState } from 'react';

/**
 * PagePurposeBanner
 * Displays an executive architecture callout at the top of each platform page,
 * explaining what the page does and how it directly contributes towards solving
 * Meridian Supply Chain's fragmented data and decentralized intelligence problem.
 */
export default function PagePurposeBanner({
  pageTitle,
  tagline,
  whatItDoes,
  solutionContribution,
  badges = []
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e7e5df',
        borderLeft: '4px solid #0e372d',
        borderRadius: '12px',
        padding: '16px 20px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.025)',
        transition: 'all 0.2s ease',
        position: 'relative'
      }}
    >
      {/* Header bar of the banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              background: '#0e372d10',
              color: '#0e372d',
              padding: '3px 9px',
              borderRadius: '6px'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            System Architecture & Purpose
          </span>

          <span style={{ fontSize: '14px', fontWeight: '700', color: '#111827' }}>
            {pageTitle}
          </span>

          {tagline && (
            <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '400' }}>
              — {tagline}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? 'Expand explanation' : 'Collapse explanation'}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            padding: '2px 6px',
            borderRadius: '4px'
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#0e372d')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
        >
          {isCollapsed ? (
            <>
              <span>Explain this page</span>
              <span style={{ fontSize: '14px' }}>▼</span>
            </>
          ) : (
            <>
              <span>Hide</span>
              <span style={{ fontSize: '14px' }}>▲</span>
            </>
          )}
        </button>
      </div>

      {/* Expanded detailed breakdown */}
      {!isCollapsed && (
        <div style={{ marginTop: '14px' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '16px',
              paddingTop: '12px',
              borderTop: '1px solid #f0eee8'
            }}
          >
            {/* Box 1: What this page does */}
            <div
              style={{
                background: '#faf9f6',
                borderRadius: '8px',
                padding: '12px 16px',
                border: '1px solid #eeebe3'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#0e372d',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                <span>📌</span>
                <span>What This Page Does</span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: '1.55',
                  color: '#374151'
                }}
              >
                {whatItDoes}
              </p>
            </div>

            {/* Box 2: How it contributes to the solution */}
            <div
              style={{
                background: '#faf9f6',
                borderRadius: '8px',
                padding: '12px 16px',
                border: '1px solid #eeebe3'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '700',
                  color: '#0e372d',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em'
                }}
              >
                <span>🎯</span>
                <span>Contribution to Jarvis Solution</span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '13px',
                  lineHeight: '1.55',
                  color: '#374151'
                }}
              >
                {solutionContribution}
              </p>
            </div>
          </div>

          {/* Badges / Architecture tags */}
          {badges && badges.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginTop: '12px',
                alignItems: 'center'
              }}
            >
              <span style={{ fontSize: '11px', color: '#9ca3af', fontWeight: '600', textTransform: 'uppercase' }}>
                Key Pillars:
              </span>
              {badges.map((b, idx) => (
                <span
                  key={idx}
                  style={{
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#4b5563',
                    background: '#f3f2ee',
                    border: '1px solid #e5e3dc',
                    padding: '2px 8px',
                    borderRadius: '12px'
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

