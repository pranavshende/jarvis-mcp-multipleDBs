-- ============================================================================
-- JARVIS V1 — PHASE 3 MIGRATION: KNOWLEDGE BASE, PGVECTOR & THREE-TIER MEMORY
-- Schema: jarvis_memory
-- Target: Supabase Cloud Managed PostgreSQL 17.11 with pgvector v0.8.2
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS jarvis_memory;

-- 1. knowledge_sources
CREATE TABLE IF NOT EXISTS jarvis_memory.knowledge_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_name VARCHAR(255) NOT NULL,
    source_type VARCHAR(64) NOT NULL, -- MARKDOWN_DOC, SESSION_LOG, MEMORY_DUMP
    source_path VARCHAR(512) UNIQUE NOT NULL,
    document_title VARCHAR(255) NOT NULL,
    owner VARCHAR(128) NOT NULL DEFAULT 'company',
    content_hash VARCHAR(128) NOT NULL,
    document_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
    sensitivity_level VARCHAR(32) NOT NULL DEFAULT 'INTERNAL' CHECK (sensitivity_level IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED_FOUNDER')),
    ingestion_status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (ingestion_status IN ('PENDING', 'INDEXED', 'QUARANTINED', 'FAILED')),
    approval_status VARCHAR(32) NOT NULL DEFAULT 'APPROVED' CHECK (approval_status IN ('APPROVED', 'PENDING_REVIEW', 'REJECTED')),
    last_ingested_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_sources_type_status ON jarvis_memory.knowledge_sources(source_type, ingestion_status);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_sensitivity ON jarvis_memory.knowledge_sources(sensitivity_level);

-- 2. document_chunks
CREATE TABLE IF NOT EXISTS jarvis_memory.document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES jarvis_memory.knowledge_sources(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    section_heading VARCHAR(255) NOT NULL DEFAULT 'Overview',
    section_path VARCHAR(512) NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    content_hash VARCHAR(128) NOT NULL,
    embedding vector(384),
    search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
    token_count INTEGER NOT NULL DEFAULT 0,
    document_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_source ON jarvis_memory.document_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_search_vector_gin ON jarvis_memory.document_chunks USING gin (search_vector);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw ON jarvis_memory.document_chunks USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- 3. memory_facts (Tier 3: Approved Global Company Memory)
CREATE TABLE IF NOT EXISTS jarvis_memory.memory_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fact TEXT NOT NULL,
    category VARCHAR(64) NOT NULL, -- PAYMENT_TERMS, OPERATIONS, LOGISTICS, PRICING, POLICY
    source_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    confidence NUMERIC(4,3) NOT NULL DEFAULT 1.000,
    approval_status VARCHAR(32) NOT NULL DEFAULT 'APPROVED' CHECK (approval_status IN ('APPROVED', 'CONFLICTING', 'DEPRECATED')),
    approved_by VARCHAR(128) NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_until TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_facts_cat_status ON jarvis_memory.memory_facts(category, approval_status);

-- 4. session_candidates (Tier 2: Staged Candidate Facts from Opted-in Sessions)
CREATE TABLE IF NOT EXISTS jarvis_memory.session_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_fact TEXT NOT NULL,
    originating_user_id VARCHAR(128) NOT NULL,
    source_session_id VARCHAR(128) NOT NULL,
    source_date DATE NOT NULL DEFAULT CURRENT_DATE,
    confidence NUMERIC(4,3) NOT NULL DEFAULT 0.750,
    corroboration_count INTEGER NOT NULL DEFAULT 1,
    corroborating_users JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CONFLICTING')),
    conflict_with_fact_id UUID REFERENCES jarvis_memory.memory_facts(id),
    conflict_details TEXT,
    sensitivity_level VARCHAR(32) NOT NULL DEFAULT 'INTERNAL' CHECK (sensitivity_level IN ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED_FOUNDER')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_candidates_status ON jarvis_memory.session_candidates(status);
CREATE INDEX IF NOT EXISTS idx_session_candidates_user ON jarvis_memory.session_candidates(originating_user_id);

-- 5. memory_approvals (Audit Log for Promotions, Rejections & Overrides)
CREATE TABLE IF NOT EXISTS jarvis_memory.memory_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    candidate_id UUID REFERENCES jarvis_memory.session_candidates(id) ON DELETE SET NULL,
    fact_id UUID REFERENCES jarvis_memory.memory_facts(id) ON DELETE SET NULL,
    decision VARCHAR(32) NOT NULL CHECK (decision IN ('APPROVE', 'REJECT', 'FLAG_CONFLICT', 'OVERRIDE')),
    reviewer_id VARCHAR(128) NOT NULL,
    reviewer_role VARCHAR(64) NOT NULL,
    comments TEXT,
    previous_status VARCHAR(32),
    new_status VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_approvals_candidate ON jarvis_memory.memory_approvals(candidate_id);
CREATE INDEX IF NOT EXISTS idx_memory_approvals_reviewer ON jarvis_memory.memory_approvals(reviewer_id);
