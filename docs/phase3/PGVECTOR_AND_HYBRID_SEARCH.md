# Jarvis v1 — pgvector & Hybrid Search Documentation

## 1. Hybrid Search Architecture

The Hybrid Search Engine (`server/services/rag/vector_store.py`) executes dual-path retrieval to capture both semantic conceptual meaning and exact term matches:

1. **Dense Semantic Retrieval**:
   - Query: `c.embedding <=> %(q_vec)s::vector`
   - Index: Supabase `pgvector` HNSW cosine index (`m = 16`, `ef_construction = 64`).
   - Retrieves top 20 conceptual matches.

2. **Sparse Exact Keyword Retrieval**:
   - Query: `c.search_vector @@ plainto_tsquery('english', %(query)s)`
   - Index: PostgreSQL `tsvector` with GIN index (`idx_document_chunks_search_vector_gin`).
   - Ranks matches using `ts_rank_cd`.
   - Retrieves top 20 exact term matches.

3. **Reciprocal Rank Fusion (RRF)**:
   Merges dense and sparse result lists:
   $$RRF(d) = \frac{1}{60 + \text{dense\_rank}(d)} + \frac{1}{60 + \text{sparse\_rank}(d)}$$

4. **Cross-Encoder Reranking**:
   Scores candidates using query term coverage, heading matches, phrase boosts, and RRF rank, returning the top 5 most authoritative chunks.

---

## 2. Citation Generation

Every returned chunk includes an immutable citation:
`Source: {source_name} ({version}) -> {section_path}`

Example:
`Source: partner-terms.md (v1.0) -> Partner terms -> Payment terms`
