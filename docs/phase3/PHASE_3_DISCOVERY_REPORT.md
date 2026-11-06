# Jarvis v1 — Phase 3 Discovery Report
## Shared Company Memory, Knowledge Base & Retrieval-Augmented Generation (RAG)

**Date**: 2026-11-06  
**Status**: DISCOVERY COMPLETE & BASELINE VERIFIED  
**Engineering Discipline**: Senior AI Systems Architect, Backend Engineer, Database Engineer & Security Engineer  
**Target Release**: Jarvis v1 — Phase 3 Knowledge Base & Governance  

---

## 1. Executive Discovery Summary

This discovery report establishes the baseline for Phase 3 of Jarvis v1: **Shared Company Memory, Knowledge Base & Retrieval-Augmented Generation (RAG)** for Meridian Supply Chain (MSC).

Phase 3 transitions Jarvis from an analytical and reactive operations monitor into an enterprise-wide institutional knowledge system. It introduces a multi-tier knowledge repository, structure-aware Markdown chunking, hybrid retrieval (dense pgvector + sparse tsvector RRF), cross-encoder reranking, and a strict three-tier memory governance model where no conversational claim is promoted to global company truth without human review or corroborated proof.

---

## 2. Existing Architecture & Reusable Foundations

### 2.1 Backend & Database Infrastructure
- **Backend Runtime**: Python 3.13 Flask REST API (`server/`) running on `http://127.0.0.1:5000`.
- **Database Engine**: Supabase Cloud Managed PostgreSQL 17.11 with Supavisor transaction pooler (`port 6543`) and direct connection pooler (`port 5432`).
- **Vector Engine**: `pgvector` v0.8.2 verified active on the database instance (`extversion: '0.8.2'`).
- **Connection Pooling**: `server/services/db_pool.py` utilizing `psycopg2.pool.ThreadedConnectionPool` with SSL/TLS encryption.
- **Existing Schemas**:
  - `analytics`: Star schema dimensions (`dim_members`, `dim_partners`, `dim_products`, `dim_warehouses`), facts (`fact_dock_receipts`, `fact_inspections`, `fact_orders`, `fact_invoices`, `fact_payouts`, `fact_cost_layers`), and materialized views (`mv_daily_receiving_summary`, `mv_partner_ar_aging`, `mv_fifo_inventory_valuation`).
  - `staging_seller`, `staging_wms`, `staging_portal`: 35 raw operational tables (67,758 rows).
  - `jarvis_alerts`: Master definitions, alert history, feedback, and snoozes.
  - `jarvis_system`: Immutable append-only audit ledger (`action_audit_ledger`).

### 2.2 Frontend Client Architecture
- **Runtime**: React 18 + Vite (`client/`) running on `http://localhost:3001`.
- **Navigation Tabs**:
  1. *Founder Ground Truth* (`FounderDashboard.jsx`)
  2. *Deterministic Metrics (15)* (`MetricsExplorer.jsx`)
  3. *Alert Center & Actions* (`AlertCenter.jsx`)
  4. *Canonical Crosswalk* (`CrosswalkViewer.jsx`)
  5. *Supabase Replication* (`SyncStatusMonitor.jsx`)
- **API Client**: `client/src/api/client.js` with centralized async methods.

### 2.3 Background Queue & Schedulers
- Dual-mode architecture in `server/services/queue/job_runner.py` with automatic in-process threaded scheduler fallback and standalone TypeScript BullMQ worker under `services/workers/`.

---

## 3. Discovery of Company Context Data Sources

An exhaustive inspection of the repository identified the following concrete operational knowledge sources:

### 3.1 Static Company Documentation (`notes/`)
Located at `notes/` (linked to `context-bank/context-bank/notes/`):
- **110 Markdown files** spanning 442.8 KB across 11 functional domains:
  - `notes/MSC Now.md`: 356 KB master document covering business overview, executive team, warehouse logistics, grading standards, seller portal, finance, wholesale operations, software systems, and open issues.
  - `notes/company/`: Org chart, goals, company glossary, founder letters, values.
  - `notes/eng/`: Architecture diagrams, crosswalk logic, database dictionaries, WMS integration specifications, tech debt logs.
  - `notes/finance/`: Working capital policies, payment terms, reconciliation guides, banking NACHA specifications, fee schedules.
  - `notes/hr/`: Employee handbook, PTO policies, compensation frameworks.
  - `notes/market/`: TCG market pricing methodologies, grading criteria, distributor discount tiers.
  - `notes/meetings/`: Executive leadership syncs, all-hands transcripts, board prep.
  - `notes/members/`: Member seller tiers, intake criteria, consignment rules, payout cadence.
  - `notes/ops/`: Warehouse SOPs (Receiving, Inspection, Grading, Vault Storage, Shipping, Damaged Goods).
  - `notes/sales/`: Partner playbooks, wholesale terms, credit line policies, price override rules.
  - `notes/team/`: Team profiles, role descriptions, escalation paths.

### 3.2 Founder-Private Topics & Isolation (`notes/founder_private/INDEX.md`)
The authoritative index explicitly lists private topics restricted to founder (Sam) access:
- `exit-options-2026.md`
- `board-deck-drafts/` (folder, 6 files)
- `bank-line-and-personal-guarantee.md`
- `comp-thoughts-priya-arjun.md`
- `1-1-notes-all.md`
- `who-i-would-hire-next.md`
- `northgate-owner-conversation.md`
- `personal-tax-2026.md`
- `things-im-not-ready-to-say.md`

*Rule*: These topics and their content must be strictly quarantined from shared vector embeddings and non-founder search queries.

### 3.3 Conversational Session Logs (`session_logs/`)
Located at `session_logs/` (linked to `context-bank/context-bank/session_logs/`):
- **195 daily log files** (341.6 KB) across 8 opted-in team members:
  - `arjun/` (Engineering)
  - `dana/` (Customer Support)
  - `hannah/` (Operations / Receiving)
  - `kenji/` (Finance / Accounting)
  - `leo/` (Warehouse / Logistics)
  - `marcus/` (Wholesale Sales)
  - `priya/` (Product / Operations)
  - `sofia/` (Partner Relations / Sales)
- Fields: `ts`, `session_id`, `user`, `tool`, `model`, `event`, `content`, token counts.
- *Rule*: Only explicitly opted-in session logs are parsed. Raw conversations remain private to originating users; only candidate facts pass into the human-gated promotion queue.

### 3.4 Historic Memory Dump (`memory.jsonl`)
Located at `memory.jsonl` (copied from `context-bank/context-bank/jarvis_v0/memory_dump.jsonl`):
- **597 historical facts** from Jarvis v0.
- Demonstrates real-world memory poisoning risks and contradictions:
  - `mem_00001`: "Standard partner payment terms are net-30." (Approved policy)
  - `mem_00004`: "Partner Blue Ridge TCG is on net-15." (Exception / Candidate)
  - Conversational revenue estimates ("Weekly revenue around \$289k").
- *Rule*: Unverified claims must never overwrite canonical approved facts.

---

## 4. Phase 3 Architecture Design

```mermaid
flowchart TD
    subgraph Multi-Source Ingestion
        NOTES[notes/ Documentation\n110 Markdown Files]
        SESSIONS[session_logs/\n8 Opted-in Users]
        MEMORY_DUMP[memory.jsonl\n597 Jarvis v0 Facts]
    end

    subgraph Deterministic Sanitization
        SANITIZER[PII & Sensitive Data Sanitizer\nRegex + NER + Founder Isolation]
        QUARANTINE[(Quarantined Content Store)]
    end

    subgraph Structural Chunking & Embedding
        CHUNKER[Smart Markdown Chunker\n512 Tokens, 10% Overlap, Table Integrity]
        EMBED[Embedding Service\ntext-embedding-3-small / bge-small-en-v1.5]
    end

    subgraph Supabase pgvector Store: jarvis_memory
        SOURCES[knowledge_sources]
        CHUNKS[document_chunks\nHNSW Cosine + tsvector GIN]
        FACTS[memory_facts\nApproved Global Memory]
        CANDIDATES[session_candidates\nTier 2 Staged Facts]
        APPROVALS[memory_approvals\nAudit Trail]
    end

    subgraph Hybrid Retrieval & Reranking
        QUERY[Search Query]
        DENSE[Dense pgvector Search]
        SPARSE[Sparse PostgreSQL Full-Text]
        RRF[Reciprocal Rank Fusion\nRRF = 1/(60+d) + 1/(60+s)]
        RERANK[Cross-Encoder Reranker]
        CITATIONS[Citation Engine\nFile -> Section -> Version]
    end

    subgraph Three-Tier Governance & UI
        TIER1[Tier 1: Private User Sessions]
        TIER2[Tier 2: Staged Candidates]
        TIER3[Tier 3: Promoted Global Memory]
        REACT_KB[React 18 Knowledge Base UI\nDashboard, Library, Candidates, Memory, Playground]
    end

    NOTES & SESSIONS & MEMORY_DUMP --> SANITIZER
    SANITIZER -->|Violations / Founder Private| QUARANTINE
    SANITIZER -->|Sanitized Clean Text| CHUNKER
    CHUNKER --> EMBED
    EMBED --> SOURCES & CHUNKS
    SESSIONS --> TIER2 --> CANDIDATES
    CANDIDATES -->|Approval / 3x Corroboration| APPROVALS --> FACTS --> TIER3
    
    QUERY --> DENSE & SPARSE
    DENSE & SPARSE --> RRF --> RERANK --> CITATIONS
    CITATIONS --> REACT_KB
```

---

## 5. Security & Privacy Constraints

1. **Zero LLM Database Writes**: The LLM has zero direct write credentials.
2. **Zero Sensitive Data Leaks**: 100+ comprehensive automated test cases with synthetic SSNs, bank accounts, routing numbers, credit cards, compensation figures, and secrets.
3. **Founder Isolation**: Founder-private topics indexed in `notes/founder_private/INDEX.md` are quarantined from shared embeddings.
4. **Three-Tier Separation**:
   - Tier 1: Private session scope (accessible only to originating user).
   - Tier 2: Staged candidate facts (visible only to reviewers).
   - Tier 3: Promoted global memory (requires domain lead approval or 3 independent corroborations).
5. **Exact Citations**: Every RAG context returned includes original filename, exact section heading, document version, and chunk ID.

---

## 6. Implementation Sequence

1. **Database Migration**: Schema `jarvis_memory` with `knowledge_sources`, `document_chunks`, `memory_facts`, `session_candidates`, and `memory_approvals`. Setup pgvector HNSW cosine index and `tsvector` GIN index.
2. **Deterministic Sanitizer**: Regex + NER engine covering SSNs, bank accounts, routing numbers, credit cards, compensation, and founder-private isolation.
3. **Markdown Chunker**: Semantic structural chunker preserving headings, list hierarchy, and table integrity (512 tokens target, 10% overlap).
4. **Embedding Service**: Provider-independent embedding service with batching, retries, and dimension validation.
5. **Hybrid Search & RRF**: Dual dense + sparse retrieval with Reciprocal Rank Fusion and cross-encoder reranking.
6. **Three-Tier Governance Engine**: Candidate extraction, contradiction detection, domain-lead approvals, and 3x corroboration logic.
7. **Flask REST API**: `/api/knowledge/` endpoints for search, retrieval, sources, candidates, and memory.
8. **React Knowledge Base UI**: Dedicated tab with Knowledge Dashboard, Document Library, Candidate Review Panel, Global Memory Explorer, and RAG Search Playground.
9. **Automated Testing & Benchmark**: 100+ sanitization tests, chunking tests, hybrid retrieval benchmarks, precision@5 evaluation, and governance tests.
10. **Phase 3 Documentation**: Complete documentation suite under `docs/phase3/`.
