import React, { useState } from 'react';

/**
 * StructuredResponse
 * Enterprise AI Response Renderer for Jarvis v1.
 * Features:
 * - Full Markdown formatting (headers, bold, italics, code blocks, tables, lists)
 * - Interactive Citation Chips with click-to-preview document drawer
 * - Section auto-detection (Executive Summary, Root Cause, Action Plan, Metrics)
 * - Copy-to-clipboard for code blocks
 */
export default function StructuredResponse({ content, citations = [], onOpenCitation }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!content) {
    return <span style={{ color: '#71717a', fontStyle: 'italic' }}>No response content returned.</span>;
  }

  const handleCopyCode = (codeText, index) => {
    navigator.clipboard.writeText(codeText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper to render inline formatting: bold, italic, code, and citation chips
  const renderInlineFormatted = (text, keyPrefix = '') => {
    if (!text) return null;

    // Pattern for Citations: [Source: file.md (v1.0) -> Section -> Heading]
    const citationRegex = /\[Source:\s*([^\]]+)\]/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = citationRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', value: text.substring(lastIndex, match.index) });
      }
      parts.push({ type: 'citation', raw: match[0], details: match[1].trim() });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push({ type: 'text', value: text.substring(lastIndex) });
    }

    return (
      <span key={keyPrefix}>
        {parts.map((p, idx) => {
          if (p.type === 'citation') {
            const label = p.details.split('->')[0].trim();
            const section = p.details.includes('->') ? p.details.substring(p.details.indexOf('->') + 2).trim() : '';

            return (
              <button
                key={`${keyPrefix}-cite-${idx}`}
                onClick={() => onOpenCitation && onOpenCitation(p.raw)}
                title={`Click to inspect verified source: ${p.details}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  margin: '0 4px',
                  padding: '1px 8px',
                  background: 'rgba(37, 99, 235, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  borderRadius: '12px',
                  color: '#93c5fd',
                  fontSize: '11.5px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  verticalAlign: 'baseline',
                  transition: 'all 0.15s ease',
                  fontFamily: 'inherit'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(37, 99, 235, 0.3)';
                  e.currentTarget.style.borderColor = '#60a5fa';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(37, 99, 235, 0.15)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.35)';
                }}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <span>{label}</span>
                {section && <span style={{ opacity: 0.65, fontSize: '10.5px' }}>› {section.slice(0, 18)}</span>}
              </button>
            );
          }

          // Render Markdown bold (**bold**), code (`code`), and italics (*italic*)
          return renderSubInline(p.value, `${keyPrefix}-sub-${idx}`);
        })}
      </span>
    );
  };

  const renderSubInline = (text, prefix) => {
    const tokens = [];
    let cur = text;
    let k = 0;

    // Split by code, bold, italic
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let match;
    let lastIdx = 0;

    while ((match = regex.exec(cur)) !== null) {
      if (match.index > lastIdx) {
        tokens.push(<span key={`${prefix}-txt-${k++}`}>{cur.substring(lastIdx, match.index)}</span>);
      }
      const val = match[0];
      if (val.startsWith('`') && val.endsWith('`')) {
        tokens.push(
          <code
            key={`${prefix}-code-${k++}`}
            style={{
              background: '#1f1f23',
              color: '#38bdf8',
              padding: '2px 6px',
              borderRadius: '5px',
              fontSize: '12.5px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            {val.slice(1, -1)}
          </code>
        );
      } else if (val.startsWith('**') && val.endsWith('**')) {
        tokens.push(
          <strong key={`${prefix}-b-${k++}`} style={{ color: '#ffffff', fontWeight: '600' }}>
            {val.slice(2, -2)}
          </strong>
        );
      } else if (val.startsWith('*') && val.endsWith('*')) {
        tokens.push(
          <em key={`${prefix}-i-${k++}`} style={{ color: '#d1d5db', fontStyle: 'italic' }}>
            {val.slice(1, -1)}
          </em>
        );
      }
      lastIdx = match.index + val.length;
    }

    if (lastIdx < cur.length) {
      tokens.push(<span key={`${prefix}-txt-${k++}`}>{cur.substring(lastIdx)}</span>);
    }

    return <span key={prefix}>{tokens}</span>;
  };

  // Parse markdown lines into structured blocks
  const parseBlocks = () => {
    const lines = content.split('\n');
    const blocks = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Code Block
      if (line.trim().startsWith('```')) {
        const lang = line.trim().replace(/^```/, '').trim() || 'text';
        const codeLines = [];
        i++;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        blocks.push({
          type: 'code',
          lang,
          code: codeLines.join('\n')
        });
        continue;
      }

      // Headers
      if (line.startsWith('#### ')) {
        blocks.push({ type: 'h4', text: line.replace(/^#### /, '').trim() });
        i++;
        continue;
      }
      if (line.startsWith('### ')) {
        blocks.push({ type: 'h3', text: line.replace(/^### /, '').trim() });
        i++;
        continue;
      }
      if (line.startsWith('## ')) {
        blocks.push({ type: 'h2', text: line.replace(/^## /, '').trim() });
        i++;
        continue;
      }
      if (line.startsWith('# ')) {
        blocks.push({ type: 'h1', text: line.replace(/^# /, '').trim() });
        i++;
        continue;
      }

      // Horizontal Rule
      if (line.trim() === '---' || line.trim() === '***') {
        blocks.push({ type: 'hr' });
        i++;
        continue;
      }

      // Bullet lists
      if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
        const items = [];
        while (i < lines.length && (lines[i].trim().startsWith('* ') || lines[i].trim().startsWith('- '))) {
          items.push(lines[i].trim().replace(/^[\*\-]\s+/, ''));
          i++;
        }
        blocks.push({ type: 'bullet_list', items });
        continue;
      }

      // Numbered lists
      if (/^\s*\d+\.\s+/.test(line)) {
        const items = [];
        while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
          i++;
        }
        blocks.push({ type: 'number_list', items });
        continue;
      }

      // Empty line
      if (!line.trim()) {
        i++;
        continue;
      }

      // Regular Paragraph (group consecutive non-empty lines)
      const pLines = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !lines[i].startsWith('#') &&
        !lines[i].trim().startsWith('```') &&
        !lines[i].trim().startsWith('* ') &&
        !lines[i].trim().startsWith('- ') &&
        !/^\s*\d+\.\s+/.test(lines[i]) &&
        lines[i].trim() !== '---'
      ) {
        pLines.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'paragraph', text: pLines.join(' ') });
    }

    return blocks;
  };

  const blocks = parseBlocks();

  // Helper to determine special styling for section headings
  const getHeaderAccent = (text) => {
    const t = text.toLowerCase();
    if (t.includes('root cause') || t.includes('investigation') || t.includes('warning') || t.includes('alert')) {
      return { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)', badge: 'ANALYSIS' };
    }
    if (t.includes('action plan') || t.includes('recommend') || t.includes('steps') || t.includes('resolution')) {
      return { border: '#10b981', bg: 'rgba(16, 185, 129, 0.08)', badge: 'ACTION' };
    }
    if (t.includes('metric') || t.includes('fifo') || t.includes('valuation') || t.includes('ar aging') || t.includes('certified')) {
      return { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', badge: 'METRIC' };
    }
    if (t.includes('citations') || t.includes('grounded') || t.includes('policy') || t.includes('sop')) {
      return { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.08)', badge: 'GOVERNANCE' };
    }
    return null;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: '#e5e7eb', fontSize: '14.5px', lineHeight: '1.65' }}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'h1':
          case 'h2': {
            const Tag = block.type;
            const accent = getHeaderAccent(block.text);

            return (
              <div
                key={idx}
                style={{
                  marginTop: '16px',
                  marginBottom: '6px',
                  paddingBottom: '6px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <Tag style={{ fontSize: block.type === 'h1' ? '20px' : '17px', fontWeight: '600', color: '#ffffff', margin: 0 }}>
                  {renderInlineFormatted(block.text, `h-${idx}`)}
                </Tag>
                {accent && (
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: accent.bg,
                      color: accent.border,
                      border: `1px solid ${accent.border}40`,
                      fontWeight: '700',
                      letterSpacing: '0.04em'
                    }}
                  >
                    {accent.badge}
                  </span>
                )}
              </div>
            );
          }

          case 'h3':
          case 'h4': {
            const accent = getHeaderAccent(block.text);

            return (
              <div
                key={idx}
                style={{
                  marginTop: '14px',
                  marginBottom: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <div
                  style={{
                    width: '3px',
                    height: '16px',
                    borderRadius: '2px',
                    background: accent ? accent.border : '#3b82f6'
                  }}
                />
                <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#f3f4f6', margin: 0 }}>
                  {renderInlineFormatted(block.text, `h3-${idx}`)}
                </h3>
              </div>
            );
          }

          case 'paragraph':
            return (
              <p key={idx} style={{ margin: 0, color: '#e5e7eb', lineHeight: '1.65' }}>
                {renderInlineFormatted(block.text, `p-${idx}`)}
              </p>
            );

          case 'bullet_list':
            return (
              <ul
                key={idx}
                style={{
                  margin: '4px 0 8px 0',
                  paddingLeft: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} style={{ color: '#d1d5db', paddingLeft: '2px' }}>
                    {renderInlineFormatted(item, `li-${idx}-${itemIdx}`)}
                  </li>
                ))}
              </ul>
            );

          case 'number_list':
            return (
              <ol
                key={idx}
                style={{
                  margin: '4px 0 8px 0',
                  paddingLeft: '22px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px'
                }}
              >
                {block.items.map((item, itemIdx) => (
                  <li key={itemIdx} style={{ color: '#d1d5db' }}>
                    {renderInlineFormatted(item, `ol-${idx}-${itemIdx}`)}
                  </li>
                ))}
              </ol>
            );

          case 'code':
            return (
              <div
                key={idx}
                style={{
                  margin: '10px 0',
                  borderRadius: '10px',
                  background: '#111113',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 12px',
                    background: '#1a1a1e',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    fontSize: '11px',
                    color: '#9ca3af',
                    fontFamily: 'ui-monospace, monospace'
                  }}
                >
                  <span style={{ textTransform: 'uppercase', fontWeight: '600' }}>{block.lang}</span>
                  <button
                    onClick={() => handleCopyCode(block.code, idx)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: copiedIndex === idx ? '#34d399' : '#9ca3af',
                      fontSize: '11px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {copiedIndex === idx ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        <span>Copy code</span>
                      </>
                    )}
                  </button>
                </div>
                <pre
                  style={{
                    margin: 0,
                    padding: '12px 14px',
                    fontSize: '12.5px',
                    lineHeight: '1.5',
                    color: '#e2e8f0',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    overflowX: 'auto',
                    background: '#111113'
                  }}
                >
                  <code>{block.code}</code>
                </pre>
              </div>
            );

          case 'hr':
            return (
              <hr
                key={idx}
                style={{
                  border: 'none',
                  borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                  margin: '12px 0'
                }}
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
}
