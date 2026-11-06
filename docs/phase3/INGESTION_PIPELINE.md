# Jarvis v1 — Ingestion Pipeline Documentation

## 1. Overview

The Knowledge Ingestion Pipeline (`server/services/rag/ingestion_pipeline.py`) processes raw multi-source company data into structured, sanitized, embedded vectors in Supabase.

---

## 2. Ingested Data Sources

### 2.1 Static Documentation (`notes/`)
- Total Files: **110 Markdown documents**
- Total Chunks Generated: **746 chunks**
- Indexed Successfully: **109 documents**
- Quarantined: **1 document** (`notes/founder_private/INDEX.md`)
- Master Document: `notes/MSC Now.md` (356 KB covering complete operational and financial context)

### 2.2 Opted-in Conversational Sessions (`session_logs/`)
- Opted-in Team Members: `arjun`, `dana`, `hannah`, `kenji`, `leo`, `marcus`, `priya`, `sofia`.
- Policy: Raw session logs are **never** embedded or exposed to other team members (Tier 1 protection). Only potential policy candidates are extracted and staged into `jarvis_memory.session_candidates`.

### 2.3 Historical Memory Facts (`memory.jsonl`)
- 597 facts from Jarvis v0 evaluated for canonical policy seeding.

---

## 3. High-Performance Bulk Ingestion

To prevent network roundtrip bottlenecks over the Supabase cloud connection pooler:
- Reuses database connections across multi-document batches.
- Employs `psycopg2.extras.execute_values` for atomic chunk insertion.
- Checks document content hash (`SHA-256`) to skip unchanged files on rerun.
