import React, { useState, useEffect } from 'react';
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
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            Company Knowledge Base & RAG Retrieval
            <span style={{ fontSize: '12px', background: 'rgba(56,189,248,0.2)', color: '#38bdf8', padding: '3px 10px', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.3)' }}>
              pgvector + HNSW Cosine
            </span>
          </h1>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
            Multi-tier verified institutional memory, Reciprocal Rank Fusion, structure-aware semantic chunking, and human-gated governance.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => handleSearch()}
            style={{
              background: '#4f46e5',
              color: '#fff',
              border: 'none',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Execute RAG Query
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Indexed Sources</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#f8fafc', marginTop: '6px' }}>
            {stats?.indexed_sources || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            {stats?.total_sources || 0} Registered Documents
          </div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase' }}>Searchable Chunks</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#38bdf8', marginTop: '6px' }}>
            {stats?.total_chunks || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
            ~{Math.round((stats?.total_tokens || 0) / 1000)}k Embedded Tokens
          </div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#4ade80', textTransform: 'uppercase' }}>Tier 3 Global Memory</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#4ade80', marginTop: '6px' }}>
            {stats?.approved_facts || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Canonical Approved Facts</div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid rgba(234,179,8,0.3)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#eab308', textTransform: 'uppercase' }}>Tier 2 Staged Candidates</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#eab308', marginTop: '6px' }}>
            {stats?.pending_candidates || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
            {stats?.conflicting_candidates || 0} Conflicting Flags
          </div>
        </div>

        <div style={{ background: '#0f172a', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#ef4444', textTransform: 'uppercase' }}>Quarantined Documents</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#ef4444', marginTop: '6px' }}>
            {stats?.quarantined_sources || 0}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Founder-Private Isolated</div>
        </div>
      </div>

      {/* Subtab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px', marginBottom: '24px' }}>
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
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              border: 'none',
              background: subTab === tab.id ? '#4f46e5' : '#1e293b',
              color: subTab === tab.id ? '#ffffff' : '#94a3b8',
              transition: 'all 0.15s ease'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Subtab 1: RAG Search Playground */}
      {subTab === 'playground' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
            <label style={{ display: 'block', fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>
              Enter Natural Language Company Query:
            </label>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
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
                  border: '1px solid rgba(255,255,255,0.15)',
                  background: '#1e293b',
                  color: '#fff',
                  fontSize: '14px'
                }}
              />
              <button
                disabled={searchLoading}
                onClick={() => handleSearch()}
                style={{
                  background: '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: searchLoading ? 'not-allowed' : 'pointer'
                }}
              >
                {searchLoading ? 'Searching...' : 'Search'}
              </button>
            </div>

            {/* Example Queries */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#64748b' }}>Try queries:</span>
              {exampleQueries.map((ex, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(ex);
                    handleSearch(ex);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    color: '#94a3b8',
                    fontSize: '11px',
                    cursor: 'pointer'
                  }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {/* RAG Context Result Block */}
          {ragContext && (
            <div style={{ background: '#0f172a', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0, color: '#4ade80', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Authorized LLM RAG Context Block
                  <span style={{ fontSize: '11px', background: 'rgba(74,222,128,0.2)', color: '#4ade80', padding: '2px 8px', borderRadius: '10px' }}>
                    100% Citation Traceability
                  </span>
                </h3>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  ~{ragContext.estimated_tokens} Tokens • {ragContext.citations?.length || 0} Citations
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {ragContext.citations?.map((cit, idx) => (
                  <span key={idx} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#818cf8', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace' }}>
                    {cit}
                  </span>
                ))}
              </div>

              <pre style={{
                background: '#070b13',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '8px',
                padding: '16px',
                fontSize: '12px',
                color: '#e2e8f0',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
                maxHeight: '300px',
                overflowY: 'auto'
              }}>
                {ragContext.context_text}
              </pre>
            </div>
          )}

          {/* Hybrid Retrieval Chunks Table */}
          {searchResults && (
            <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 16px 0', color: '#f8fafc' }}>
                Retrieved & Reranked Semantic Chunks (Top {searchResults.results?.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {searchResults.results?.map((r, idx) => (
                  <div
                    key={r.chunk_id || idx}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderRadius: '8px',
                      padding: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontWeight: '600', color: '#818cf8', fontSize: '13px' }}>
                        #{idx + 1} {r.citation}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '11px' }}>
                        <span style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', padding: '2px 6px', borderRadius: '4px' }}>
                          RRF: {r.rrf_score}
                        </span>
                        <span style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', padding: '2px 6px', borderRadius: '4px' }}>
                          Rerank: {r.rerank_score}
                        </span>
                        <span style={{ background: 'rgba(148,163,184,0.15)', color: '#94a3b8', padding: '2px 6px', borderRadius: '4px' }}>
                          Dense: {r.dense_score?.toFixed(3)}
                        </span>
                      </div>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5' }}>
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
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0 }}>Registered Company Documentation</h3>
            <input
              type="text"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              placeholder="Filter by filename or title..."
              style={{
                background: '#1e293b',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '6px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                width: '260px'
              }}
            />
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '10px' }}>Document Title</th>
                  <th style={{ padding: '10px' }}>Filename</th>
                  <th style={{ padding: '10px' }}>Chunks</th>
                  <th style={{ padding: '10px' }}>Sensitivity</th>
                  <th style={{ padding: '10px' }}>Status</th>
                  <th style={{ padding: '10px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sources
                  .filter((s) => s.document_title.toLowerCase().includes(sourceFilter.toLowerCase()) || s.source_name.toLowerCase().includes(sourceFilter.toLowerCase()))
                  .map((src) => (
                    <tr key={src.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', color: '#cbd5e1' }}>
                      <td style={{ padding: '10px', fontWeight: '600', color: '#f8fafc' }}>{src.document_title}</td>
                      <td style={{ padding: '10px', fontFamily: 'monospace', color: '#94a3b8' }}>{src.source_name}</td>
                      <td style={{ padding: '10px' }}>{src.chunk_count}</td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          background: src.sensitivity_level === 'RESTRICTED_FOUNDER' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
                          color: src.sensitivity_level === 'RESTRICTED_FOUNDER' ? '#ef4444' : '#60a5fa',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          {src.sensitivity_level}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <span style={{
                          background: src.ingestion_status === 'INDEXED' ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)',
                          color: src.ingestion_status === 'INDEXED' ? '#4ade80' : '#ef4444',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold'
                        }}>
                          {src.ingestion_status}
                        </span>
                      </td>
                      <td style={{ padding: '10px' }}>
                        <button
                          onClick={() => handleInspectSource(src.id)}
                          style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
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
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
              Tier 2 Staged Candidates (Human Approval Queue)
            </h3>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
              Extracted from opted-in team AI sessions. Candidates require domain lead review or 3x corroboration before entering shared company truth.
            </p>
          </div>

          {candidates.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
              No staged candidate facts awaiting review.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {candidates.map((cand) => (
                <div
                  key={cand.id}
                  style={{
                    background: cand.status === 'CONFLICTING' ? 'rgba(239,68,68,0.05)' : 'rgba(255,255,255,0.02)',
                    border: cand.status === 'CONFLICTING' ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        background: cand.status === 'CONFLICTING' ? 'rgba(239,68,68,0.2)' : 'rgba(234,179,8,0.2)',
                        color: cand.status === 'CONFLICTING' ? '#ef4444' : '#eab308',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 'bold'
                      }}>
                        {cand.status}
                      </span>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        Source: {cand.originating_user_id} ({cand.source_session_id})
                      </span>
                      <span style={{ background: 'rgba(99,102,241,0.2)', color: '#818cf8', padding: '2px 6px', borderRadius: '10px', fontSize: '11px' }}>
                        {cand.corroboration_count}x Corroborated
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => handleApproveCandidate(cand.id)}
                        style={{ background: '#22c55e', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        Approve to Global Memory
                      </button>
                      <button
                        onClick={() => handleRejectCandidate(cand.id)}
                        style={{ background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>

                  <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#f8fafc', fontWeight: '500' }}>
                    "{cand.candidate_fact}"
                  </p>

                  {cand.status === 'CONFLICTING' && cand.conflict_details && (
                    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#fca5a5' }}>
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
        <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '20px' }}>
          <div style={{ marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#4ade80' }}>
              Tier 3 Approved Global Company Memory
            </h3>
            <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
              Permanent, verified institutional knowledge facts with complete approver audit history.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {facts.map((fact) => (
              <div
                key={fact.id}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(74,222,128,0.2)',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                      {fact.category}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Approved by: <strong>{fact.approved_by}</strong> ({new Date(fact.approved_at).toLocaleDateString()})
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', color: '#f8fafc', fontWeight: '500' }}>
                    {fact.fact}
                  </div>
                </div>
                <span style={{ background: 'rgba(255,255,255,0.05)', color: '#38bdf8', padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 'bold' }}>
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
          background: 'rgba(0,0,0,0.85)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '16px',
            maxWidth: '800px',
            width: '100%',
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            padding: '24px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#f8fafc' }}>
                  {selectedSource.document_title}
                </h3>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                  {selectedSource.source_name} • {sourceChunks.length} Chunks
                </div>
              </div>
              <button
                onClick={() => setSelectedSource(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {sourceChunks.map((c) => (
                <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#818cf8', marginBottom: '6px' }}>
                    <span>Chunk #{c.chunk_index + 1} — {c.section_path || c.section_heading}</span>
                    <span>{c.token_count} tokens</span>
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px', color: '#cbd5e1', lineHeight: '1.5' }}>
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
