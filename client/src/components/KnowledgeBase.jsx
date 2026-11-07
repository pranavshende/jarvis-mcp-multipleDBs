import React, { useState, useEffect } from 'react';
import PagePurposeBanner from './PagePurposeBanner';
import {
  fetchKnowledgeStats,
  fetchKnowledgeSources,
  fetchKnowledgeSourceDetails,
  triggerKnowledgeIngestion,
  searchKnowledge,
  retrieveRagContext,
  fetchCandidateFacts,
  approveCandidateFact,
  rejectCandidateFact,
  fetchGlobalMemory
} from '../api/client';

export default function KnowledgeBase() {
  const [subTab, setSubTab] = useState('playground');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Playground state
  const [query, setQuery] = useState('What are our standard partner payment terms?');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [ragContext, setRagContext] = useState(null);

  // Document Library state
  const [sources, setSources] = useState([]);
  const [sourceFilter, setSourceFilter] = useState('');
  const [selectedSource, setSelectedSource] = useState(null);
  const [sourceChunks, setSourceChunks] = useState([]);

  // Candidate Review state
  const [candidates, setCandidates] = useState([]);

  // Global Memory state
  const [facts, setFacts] = useState([]);

  useEffect(() => {
    loadStats();
    loadSubTabData(subTab);
  }, [subTab]);

  async function loadStats() {
    try {
      const res = await fetchKnowledgeStats();
      if (res.success) setStats(res.stats);
    } catch (err) {
      console.error('Failed to load knowledge stats:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadSubTabData(tab) {
    try {
      if (tab === 'library') {
        const res = await fetchKnowledgeSources('', 100);
        if (res.success) setSources(res.sources);
      } else if (tab === 'candidates') {
        const res = await fetchCandidateFacts();
        if (res.success) setCandidates(res.candidates);
      } else if (tab === 'memory') {
        const res = await fetchGlobalMemory();
        if (res.success) setFacts(res.facts);
      }
    } catch (err) {
      console.error('Error loading subtab data:', err);
    }
  }

  async function handleSearch(overrideQuery) {
    const q = overrideQuery || query;
    if (!q.trim()) return;
    setSearchLoading(true);
    try {
      const [searchRes, contextRes] = await Promise.all([
        searchKnowledge(q, 5, 'ROLE_FOUNDER'),
        retrieveRagContext(q, 5, 'ROLE_FOUNDER')
      ]);
      if (searchRes.success) setSearchResults(searchRes);
      if (contextRes.success) setRagContext(contextRes);
    } catch (err) {
      alert('Search failed: ' + err.message);
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleInspectSource(sourceId) {
    try {
      const res = await fetchKnowledgeSourceDetails(sourceId);
      if (res.success) {
        setSelectedSource(res.source);
        setSourceChunks(res.chunks);
      }
    } catch (err) {
      alert('Failed to load source details: ' + err.message);
    }
  }

  async function handleApproveCandidate(candId) {
    if (!confirm('Promote this candidate fact to Tier 3 Global Memory?')) return;
    try {
      const res = await approveCandidateFact(candId, 'EMP-001 (Founder)', 'ROLE_FOUNDER', 'Approved via Knowledge Base UI');
      if (res.success) {
        alert('Candidate promoted to Tier 3 Global Memory!');
        loadSubTabData('candidates');
        loadStats();
      } else {
        alert('Approval failed: ' + res.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function handleRejectCandidate(candId) {
    if (!confirm('Reject and quarantine this candidate fact?')) return;
    try {
      const res = await rejectCandidateFact(candId, 'EMP-001 (Founder)', 'ROLE_FOUNDER', 'Rejected via Knowledge Base UI');
      if (res.success) {
        alert('Candidate rejected.');
        loadSubTabData('candidates');
        loadStats();
      } else {
        alert('Rejection failed: ' + res.error);
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  const exampleQueries = [
    'What are our standard partner payment terms?',
    'How does raw consignment receiving and grading scan work?',
    'What is the credit line limit approval threshold?',
    'Who are the members of the executive leadership team?',
    'What are the packaging inspection fail reasons?'
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px 12px', color: '#1a1c19', boxSizing: 'border-box' }}>
      <PagePurposeBanner
        pageTitle="Company Knowledge Base & pgvector RAG Retrieval"
        tagline="Multi-tier verified institutional memory, Reciprocal Rank Fusion, and strict human governance"
        whatItDoes="Indexes 109 verified organizational documents into 746 semantic chunks across standard operating procedures (SOPs), grading rules, SLA governance, and executive leadership documents. It supports semantic cosine search, RAG contextual retrieval, and candidate review queues."
        solutionContribution="Solves Meridian's document fragmentation problem where critical operating policies, grading rules, and partner agreements are lost across drives and emails. Jarvis provides verified answers with exact chunk citations while strictly quarantining confidential founder memory from general retrieval."
        badges={[
          'pgvector HNSW Cosine Indexing',
          'Reciprocal Rank Fusion (RRF)',
          '3-Tier Memory Governance',
          'Founder-Private Isolation',
          'Verifiable Chunk Citations'
        ]}
      />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '24px' }}>
        <div style={{ flex: '1', minWidth: 'min(100%, 280px)' }}>
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            Company Knowledge Base & RAG Retrieval
            <span style={{ fontSize: '12px', background: '#e0f2fe', color: '#0369a1', padding: '3px 10px', borderRadius: '12px', border: '1px solid #bae6fd', fontWeight: '500' }}>
              pgvector + HNSW Cosine
            </span>
          </h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
            Multi-tier verified institutional memory, Reciprocal Rank Fusion, structure-aware semantic chunking, and human-gated governance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleSearch()}
            style={{
              background: '#0e372d',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(14, 55, 45, 0.2)',
              whiteSpace: 'nowrap'
            }}
          >
            Execute RAG Query
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 140px), 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e5e5e0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase' }}>Indexed Sources</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginTop: '6px' }}>
            {stats?.indexed_sources || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            {stats?.total_sources || 0} Registered Documents
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e5e5e0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500', textTransform: 'uppercase' }}>Searchable Chunks</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#0284c7', marginTop: '6px' }}>
            {stats?.total_chunks || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>
            ~{Math.round((stats?.total_tokens || 0) / 1000)}k Embedded Tokens
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: '#15803d', fontWeight: '600', textTransform: 'uppercase' }}>Tier 3 Global Memory</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#15803d', marginTop: '6px' }}>
            {stats?.approved_facts || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#166534', marginTop: '4px' }}>Canonical Approved Facts</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #fde68a', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: '#b45309', fontWeight: '600', textTransform: 'uppercase' }}>Tier 2 Staged Candidates</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#b45309', marginTop: '6px' }}>
            {stats?.pending_candidates || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#92400e', marginTop: '4px' }}>
            {stats?.conflicting_candidates || 0} Conflicting Flags
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #fecaca', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: '600', textTransform: 'uppercase' }}>Quarantined Documents</div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: '#dc2626', marginTop: '6px' }}>
            {stats?.quarantined_sources || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '4px' }}>Founder-Private Isolated</div>
        </div>
      </div>

      {/* Subtab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e5e5e0', paddingBottom: '12px', marginBottom: '24px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', flexWrap: 'nowrap' }}>
        {[
          { id: 'playground', label: 'RAG Search Playground' },
          { id: 'library', label: 'Document Library (110)' },
          { id: 'candidates', label: `Candidate Review (${stats?.pending_candidates || 0})` },
          { id: 'memory', label: `Global Memory Explorer (${stats?.approved_facts || 0})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              border: '1px solid',
              borderColor: subTab === tab.id ? '#0e372d' : '#ded9d2',
              background: subTab === tab.id ? '#0e372d' : '#ffffff',
              color: subTab === tab.id ? '#ffffff' : '#4b5563',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Subtab 1: RAG Search Playground */}
      {subTab === 'playground' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e5e5e0', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
              Enter Natural Language Company Query:
            </label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ask anything across company SOPs, partner terms, or finance policies..."
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid #ded9d2',
                  background: '#ffffff',
                  color: '#111827',
                  fontSize: '14px'
                }}
              />
              <button
                disabled={searchLoading}
                onClick={() => handleSearch()}
                style={{
                  background: '#0e372d',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: searchLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Example Queries */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: '500' }}>Try queries:</span>
              {exampleQueries.map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(ex);
                    handleSearch(ex);
                  }}
                  style={{
                    background: '#f8f7f4',
                    border: '1px solid #e8e6df',
                    borderRadius: '6px',
                    padding: '5px 12px',
                    color: '#4b5563',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0e372d';
                    e.currentTarget.style.color = '#0e372d';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e8e6df';
                    e.currentTarget.style.color = '#4b5563';
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* RAG Context Result Block */}
          {ragContext && (
            <div style={{ background: '#ffffff', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '700', margin: 0, color: '#15803d', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Authorized LLM RAG Context Block
                  <span style={{ fontSize: '11px', background: '#e8f5ec', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '10px', fontWeight: '600' }}>
                    100% Citation Traceability
                  </span>
                </h3>
                <span style={{ fontSize: '11px', color: '#6b7280' }}>
                  ~{ragContext.estimated_tokens} Tokens • {ragContext.citations?.length || 0} Citations
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {ragContext.citations?.map((cit, idx) => (
                  <span key={idx} style={{ background: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace', fontWeight: '500' }}>
                    {cit}
                  </span>
                ))}
              </div>

              <pre style={{
                background: '#f8f7f4',
                border: '1px solid #e8e6df',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '12px',
                color: '#1f2937',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
                maxHeight: '300px',
                overflowY: 'auto',
                fontFamily: 'monospace'
              }}>
                {ragContext.context_text}
              </pre>
            </div>
          )}

          {/* Hybrid Retrieval Chunks Table */}
          {searchResults && (
            <div style={{ background: '#ffffff', border: '1px solid #e5e5e0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 16px 0', color: '#111827' }}>
                Retrieved & Reranked Semantic Chunks (Top {searchResults.results?.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {searchResults.results?.map((r, idx) => (
                  <div
                    key={r.chunk_id || idx}
                    style={{
                      background: '#f8f7f4',
                      border: '1px solid #e8e6df',
                      borderRadius: '8px',
                      padding: '16px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '600', color: '#0e372d', fontSize: '13px' }}>
                        #{idx + 1} {r.citation}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                        <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                          RRF: {r.rrf_score}
                        </span>
                        <span style={{ background: '#e8f5ec', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 6px', borderRadius: '4px', fontWeight: '500' }}>
                          Rerank: {r.rerank_score}
                        </span>
                        <span style={{ background: '#f3f4f6', color: '#4b5563', border: '1px solid #e5e7eb', padding: '2px 6px', borderRadius: '4px' }}>
                          Dense: {r.dense_score?.toFixed(3)}
                        </span>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#374151', lineHeight: '1.5' }}>
                      {r.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Subtab 2: Document Library */}
      {subTab === 'library' && (
        <div style={{ background: '#ffffff', border: '1px solid #e5e5e0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: 0 }}>Registered Company Documentation</h3>
            <input
              type="text"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              placeholder="Filter by filename or title..."
              style={{
                background: '#ffffff',
                color: '#111827',
                border: '1px solid #ded9d2',
                padding: '8px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                width: '260px'
              }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e5e0', background: '#f8f7f4', textAlign: 'left', color: '#4b5563' }}>
                  <th style={{ padding: '10px 14px' }}>Document Title</th>
                  <th style={{ padding: '10px 14px' }}>Filename</th>
                  <th style={{ padding: '10px 14px' }}>Chunks</th>
                  <th style={{ padding: '10px 14px' }}>Sensitivity</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources
                  .filter((s) => s.document_title.toLowerCase().includes(sourceFilter.toLowerCase()) || s.source_name.toLowerCase().includes(sourceFilter.toLowerCase()))
                  .map((src) => (
                    <tr key={src.id} style={{ borderBottom: '1px solid #f3f4f6', color: '#1f2937' }}>
                      <td style={{ padding: '10px 14px', fontWeight: '600', color: '#111827' }}>{src.document_title}</td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', color: '#6b7280' }}>{src.source_name}</td>
                      <td style={{ padding: '10px 14px', color: '#4b5563' }}>{src.chunk_count}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          background: src.sensitivity_level === 'RESTRICTED_FOUNDER' ? '#fee2e2' : '#eff6ff',
                          color: src.sensitivity_level === 'RESTRICTED_FOUNDER' ? '#dc2626' : '#1e40af',
                          border: `1px solid ${src.sensitivity_level === 'RESTRICTED_FOUNDER' ? '#fecaca' : '#bfdbfe'}`,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {src.sensitivity_level}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{
                          background: src.ingestion_status === 'INDEXED' ? '#e8f5ec' : '#fee2e2',
                          color: src.ingestion_status === 'INDEXED' ? '#166534' : '#dc2626',
                          border: `1px solid ${src.ingestion_status === 'INDEXED' ? '#bbf7d0' : '#fecaca'}`,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '600'
                        }}>
                          {src.ingestion_status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button
                          onClick={() => handleInspectSource(src.id)}
                          style={{ background: '#ffffff', color: '#0e372d', border: '1px solid #0e372d', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}
                        >
                          View Chunks
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab 3: Candidate Review (Tier 2) */}
      {subTab === 'candidates' && (
        <div style={{ background: '#ffffff', border: '1px solid #e5e5e0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#111827', margin: '0 0 4px 0' }}>
              Tier 2 Staged Candidates (Human Approval Queue)
            </h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
              Extracted from opted-in team AI sessions. Candidates require domain lead review or 3x corroboration before entering shared company truth.
            </p>
          </div>

          {candidates.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
              No staged candidate facts awaiting review.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {candidates.map((cand) => (
                <div
                  key={cand.id}
                  style={{
                    background: cand.status === 'CONFLICTING' ? '#fff5f5' : '#f8f7f4',
                    border: cand.status === 'CONFLICTING' ? '1px solid #fecaca' : '1px solid #e8e6df',
                    borderRadius: '8px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: cand.status === 'CONFLICTING' ? '#fee2e2' : '#fef3c7',
                        color: cand.status === 'CONFLICTING' ? '#dc2626' : '#b45309',
                        border: `1px solid ${cand.status === 'CONFLICTING' ? '#fecaca' : '#fde68a'}`,
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: '600'
                      }}>
                        {cand.status}
                      </span>
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        Source: {cand.originating_user_id} ({cand.source_session_id})
                      </span>
                      <span style={{ background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', padding: '2px 6px', borderRadius: '10px', fontSize: '11px', fontWeight: '500' }}>
                        {cand.corroboration_count}x Corroborated
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleApproveCandidate(cand.id)}
                        style={{ background: '#16a34a', color: '#fff', border: 'none', padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: '600', cursor: 'pointer' }}
                      >
                        Approve to Global Memory
                      </button>
                      <button
                        onClick={() => handleRejectCandidate(cand.id)}
                        style={{ background: '#ffffff', color: '#dc2626', border: '1px solid #fecaca', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer' }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                    "{cand.candidate_fact}"
                  </p>

                  {cand.status === 'CONFLICTING' && cand.conflict_details && (
                    <div style={{ background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#991b1b' }}>
                      ⚠️ <strong>Contradiction Warning:</strong> {cand.conflict_details}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subtab 4: Global Memory Explorer (Tier 3) */}
      {subTab === 'memory' && (
        <div style={{ background: '#ffffff', border: '1px solid #e5e5e0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', margin: '0 0 4px 0', color: '#15803d' }}>
              Tier 3 Approved Global Company Memory
            </h3>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>
              Permanent, verified institutional knowledge facts with complete approver audit history.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {facts.map((fact) => (
              <div
                key={fact.id}
                style={{
                  background: '#f8f7f4',
                  border: '1px solid #e8e6df',
                  borderRadius: '8px',
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ background: '#e8f5ec', color: '#166534', border: '1px solid #bbf7d0', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                      {fact.category}
                    </span>
                    <span style={{ fontSize: '11px', color: '#6b7280' }}>
                      Approved by: <strong>{fact.approved_by}</strong> ({new Date(fact.approved_at).toLocaleDateString()})
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#111827', fontWeight: '500' }}>
                    {fact.fact}
                  </div>
                </div>
                <span style={{ background: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
                  {(fact.confidence * 100).toFixed(0)}% Conf
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal for viewing document chunks */}
      {selectedSource && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e5e5e0',
            borderRadius: '16px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            boxShadow: '0 20px 40px -15px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#111827' }}>
                  {selectedSource.document_title}
                </h3>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>
                  {selectedSource.source_name} • {sourceChunks.length} Chunks
                </div>
              </div>
              <button
                onClick={() => setSelectedSource(null)}
                style={{ background: 'transparent', border: 'none', color: '#6b7280', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sourceChunks.map((c) => (
                <div key={c.id} style={{ background: '#f8f7f4', border: '1px solid #e8e6df', borderRadius: '8px', padding: '14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#0e372d', fontWeight: '600', marginBottom: '6px' }}>
                    <span>Chunk #{c.chunk_index + 1} — {c.section_path || c.section_heading}</span>
                    <span style={{ color: '#6b7280', fontWeight: '400' }}>{c.token_count} tokens</span>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px', color: '#374151', lineHeight: '1.5', fontFamily: 'monospace' }}>
                    {c.content}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
