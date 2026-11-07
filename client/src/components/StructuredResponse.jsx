import React, { useState } from 'react';

/**
 * StructuredResponse
 * 100% Dynamic Enterprise AI Response Renderer for Jarvis AI.
 * Completely free of hardcoded mock data, partner IDs, or synthetic cards.
 * Features:
 * - Dynamic Markdown Headers with green accent bar
 * - Dynamic Markdown Tables rendered as clean white enterprise cards
 * - Dynamic Steppers & Lists for operational procedures
 * - Dynamic Citation Chips with click-to-preview
 * - Code blocks with copy-to-clipboard
 */
export default function StructuredResponse({ content, citations = [], onOpenCitation }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (!content) {
    return <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>No response content returned.</span>;
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
                title={`Click to inspect certified source: ${p.details}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  margin: '0 3px',
                  padding: '2px 8px',
                  background: '#ffffff',
                  border: '1px solid #e2e0d8',
                  borderRadius: '6px',
                  color: '#1f2937',
                  fontSize: '11px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  verticalAlign: 'baseline',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0e372d';
                  e.currentTarget.style.color = '#0e372d';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e2e0d8';
                  e.currentTarget.style.color = '#1f2937';
                }}
              >
                <span>{label}</span>
                {section && <span style={{ color: '#6b7280', fontSize: '10.5px' }}>› {section.slice(0, 20)}</span>}
                <span style={{ fontSize: '10px', opacity: 0.6 }}>↗</span>
              </button>
            );
          }

          return renderSubInline(p.value, `${keyPrefix}-sub-${idx}`);
        })}
      </span>
    );
  };

  const renderSubInline = (text, prefix) => {
    const tokens = [];
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let match;
    let lastIdx = 0;
    let k = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        tokens.push(<span key={`${prefix}-txt-${k++}`}>{text.substring(lastIdx, match.index)}</span>);
      }
      const val = match[0];
      if (val.startsWith('`') && val.endsWith('`')) {
        tokens.push(
          <code
            key={`${prefix}-code-${k++}`}
            style={{
              background: '#f1f0eb',
              color: '#0e372d',
              padding: '1px 5px',
              borderRadius: '4px',
              fontSize: '12px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              border: '1px solid #e5e3dc'
            }}
          >
            {val.slice(1, -1)}
          </code>
        );
      } else if (val.startsWith('**') && val.endsWith('**')) {
        tokens.push(
          <strong key={`${prefix}-b-${k++}`} style={{ color: '#111827', fontWeight: '600' }}>
            {val.slice(2, -2)}
          </strong>
        );
      } else if (val.startsWith('*') && val.endsWith('*')) {
        tokens.push(
          <em key={`${prefix}-i-${k++}`} style={{ color: '#4b5563', fontStyle: 'italic' }}>
            {val.slice(1, -1)}
          </em>
        );
      }
      lastIdx = match.index + val.length;
    }

    if (lastIdx < text.length) {
      tokens.push(<span key={`${prefix}-txt-${k++}`}>{text.substring(lastIdx)}</span>);
    }

    return <span key={prefix}>{tokens}</span>;
  };

  // Parse markdown lines dynamically into structured blocks
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

      // Markdown Tables
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        const tableLines = [];
        while (i < lines.length && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
          tableLines.push(lines[i].trim());
          i++;
        }
        if (tableLines.length >= 2) {
          const parseRow = (rowStr) =>
            rowStr
              .slice(1, -1)
              .split('|')
              .map((c) => c.trim());
          
          const headers = parseRow(tableLines[0]);
          // Filter out the separator line (|---|---|)
          const dataRows = tableLines.slice(2).map(parseRow);
          blocks.push({ type: 'table', headers, rows: dataRows });
          continue;
        }
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
        !lines[i].trim().startsWith('|') &&
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

  // Extract all citations dynamically from content
  const allCitationMatches = [];
  const citeRegex = /\[Source:\s*([^\]]+)\]/g;
  let cm;
  while ((cm = citeRegex.exec(content)) !== null) {
    if (!allCitationMatches.includes(cm[1].trim())) {
      allCitationMatches.push(cm[1].trim());
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', color: '#1f2937', fontSize: '14.5px', lineHeight: '1.65' }}>
      
      {/* Dynamically Parsed Blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {blocks.map((block, idx) => {
          switch (block.type) {
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', marginBottom: '2px' }}>
                  <div style={{ width: '3px', height: '16px', borderRadius: '2px', background: '#0e372d' }} />
                  <h3 style={{ fontSize: block.type === 'h1' ? '17px' : '15px', fontWeight: '700', color: '#111827', margin: 0 }}>
                    {renderInlineFormatted(block.text, `h-${idx}`)}
                  </h3>
                </div>
              );

            case 'paragraph':
              return (
                <p key={idx} style={{ margin: 0, color: '#374151', lineHeight: '1.65' }}>
                  {renderInlineFormatted(block.text, `p-${idx}`)}
                </p>
              );

            case 'table':
              return (
                <div
                  key={idx}
                  style={{
                    margin: '8px 0',
                    background: '#ffffff',
                    border: '1px solid #e5e5e0',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)'
                  }}
                >
                  <div className="scroll-x-touch" style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: '#f8f7f4', borderBottom: '1px solid #e5e5e0' }}>
                          {block.headers.map((h, hIdx) => (
                            <th key={hIdx} style={{ padding: '8px 12px', fontWeight: '600', color: '#111827' }}>
                              {renderInlineFormatted(h, `th-${idx}-${hIdx}`)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row, rIdx) => (
                          <tr key={rIdx} style={{ borderBottom: rIdx < block.rows.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                            {row.map((cell, cIdx) => (
                              <td key={cIdx} style={{ padding: '8px 12px', color: '#374151' }}>
                                {renderInlineFormatted(cell, `td-${idx}-${rIdx}-${cIdx}`)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );

            case 'bullet_list':
              return (
                <ul key={idx} style={{ margin: '4px 0 8px 0', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {block.items.map((item, itemIdx) => (
                    <li key={itemIdx} style={{ color: '#4b5563', paddingLeft: '2px' }}>
                      {renderInlineFormatted(item, `li-${idx}-${itemIdx}`)}
                    </li>
                  ))}
                </ul>
              );

            case 'number_list':
              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '6px 0' }}>
                  {block.items.map((item, itemIdx) => (
                    <div
                      key={itemIdx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        background: '#ffffff',
                        border: '1px solid #e5e5e0',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)'
                      }}
                    >
                      <span
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          background: itemIdx === 0 ? '#0e372d' : '#f3f2ee',
                          color: itemIdx === 0 ? '#ffffff' : '#4b5563',
                          fontSize: '11px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {itemIdx + 1}
                      </span>
                      <div style={{ flex: 1, fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>
                        {renderInlineFormatted(item, `ol-${idx}-${itemIdx}`)}
                      </div>
                    </div>
                  ))}
                </div>
              );

            case 'code':
              return (
                <div key={idx} style={{ margin: '8px 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #e5e5e0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: '#f3f2ee', borderBottom: '1px solid #e5e5e0', fontSize: '11px', color: '#6b7280' }}>
                    <span>{block.lang}</span>
                    <button
                      onClick={() => handleCopyCode(block.code, idx)}
                      style={{ background: 'transparent', border: 'none', color: '#4b5563', cursor: 'pointer', fontSize: '11px' }}
                    >
                      {copiedIndex === idx ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre style={{ margin: 0, padding: '12px', background: '#ffffff', color: '#1f2937', fontSize: '12.5px', overflowX: 'auto', fontFamily: 'monospace' }}>
                    <code>{block.code}</code>
                  </pre>
                </div>
              );

            case 'hr':
              return <hr key={idx} style={{ border: 'none', borderTop: '1px solid #e5e5e0', margin: '12px 0' }} />;

            default:
              return null;
          }
        })}
      </div>

      {/* Dynamic Citations & Sources Row */}
      {(allCitationMatches.length > 0 || citations.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid #f3f4f6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: '600', color: '#6b7280' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
            <span>Sources</span>
          </div>

          {(allCitationMatches.length > 0 ? allCitationMatches : citations).map((rawCite, cIdx) => {
            const cleanText = typeof rawCite === 'string' ? rawCite.replace(/^\[Source:\s*/, '').replace(/\]$/, '') : '';
            return (
              <button
                key={cIdx}
                onClick={() => onOpenCitation && onOpenCitation(rawCite)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '4px 10px',
                  background: '#ffffff',
                  border: '1px solid #e5e5e0',
                  borderRadius: '6px',
                  color: '#374151',
                  fontSize: '11.5px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#0e372d';
                  e.currentTarget.style.color = '#0e372d';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#e5e5e0';
                  e.currentTarget.style.color = '#374151';
                }}
              >
                <span>{cleanText}</span>
                <span style={{ fontSize: '11px', opacity: 0.6 }}>↗</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
