# Jarvis v1 — Phase 3 System Architecture
## Knowledge Base, pgvector & Three-Tier Memory

## 1. System Topology & Core Principles

Phase 3 builds the enterprise institutional knowledge system for Meridian Supply Chain (MSC). The architecture is defined by four core principles:

1. **Zero LLM Database Writes**: The LLM agent has no autonomous database credentials or authority to create canonical company policy.
2. **Deterministic Sanitization Before Vectorization**: Raw PII (SSNs, credit cards, bank accounts, routing numbers, executive salaries) and founder-private notes are redacted or quarantined prior to chunking and embedding generation.
3. **Hybrid Search with Reciprocal Rank Fusion**: Dense semantic vector similarity (`pgvector` cosine distance) is combined with sparse exact keyword matching (`tsvector` and GIN index) and cross-encoder reranking.
4. **Three-Tier Knowledge Governance**: Conversations may propose ideas, but only domain-approved or 3x-corroborated facts enter shared company truth.

---

## 2. Component Diagram

```mermaid
flowchart TD
    subgraph Data Sources
        NOTES[notes/\n110 Markdown Documents]
        SESSIONS[session_logs/\n8 Opted-in Team Members]
        CANONICAL[memory.jsonl\n597 Historical Facts]
    end

    subgraph Security & Sanitization
        SAN[DocumentSanitizer\nRegex + NER + Founder Isolation]
        QUARANTINE[(Quarantine Store)]
    end

    subgraph Processing Pipeline
        CHUNKER[MarkdownChunker\n512 Tokens, 10% Overlap, Table Headers]
        EMB[EmbeddingService\n384-dim Dense Vectors]
    end

    subgraph Supabase pgvector Storage (jarvis_memory)
        SOURCES[knowledge_sources]
        CHUNKS[document_chunks\nHNSW Cosine + tsvector GIN]
        FACTS[memory_facts\nTier 3 Approved Global Memory]
        CANDIDATES[session_candidates\nTier 2 Staged Facts]
        APPROVALS[memory_approvals\nAudit Log]
    end

    subgraph Hybrid Retrieval & Reranker
        Q[Natural Language Query]
        DENSE[pgvector Cosine Search]
        SPARSE[PostgreSQL tsvector GIN Search]
        RRF[Reciprocal Rank Fusion\nRRF = 1/(60+d) + 1/(60+s)]
        RERANK[Cross-Encoder Reranker]
        CITATION[Exact Citation Engine\nFile -> Heading -> Version]
    end

    NOTES & SESSIONS & CANONICAL --> SAN
    SAN -->|Founder Private / Leaks| QUARANTINE
    SAN -->|Sanitized Text| CHUNKER --> EMB --> CHUNKS
    SESSIONS --> CANDIDATES
    CANDIDATES -->|Approval / 3x Corroboration| APPROVALS --> FACTS

    Q --> DENSE & SPARSE
    DENSE & SPARSE --> RRF --> RERANK --> CITATION
```

---

## 3. Database Schema: `jarvis_memory`

| Table | Description | Key Indexes / Constraints |
|---|---|---|
| `knowledge_sources` | Master registry of ingested documentation, version, content hash, and quarantine status | `UNIQUE(source_path)`, Index on `(source_type, ingestion_status)` |
| `document_chunks` | Sanitized 512-token chunks with 384-dimensional dense embeddings and full-text search vectors | HNSW index on `embedding` (`m=16, ef_construction=64`), GIN index on `search_vector` |
| `memory_facts` | Tier 3 canonical company facts approved by domain leads or 3x corroboration | Index on `(category, approval_status)` |
| `session_candidates` | Tier 2 staged facts extracted from opted-in conversations awaiting human review | Foreign key to `memory_facts(id)` for contradiction tracking |
| `memory_approvals` | Immutable audit trail for promotions, rejections, and conflict flags | Foreign keys to `candidate_id` and `fact_id` |
