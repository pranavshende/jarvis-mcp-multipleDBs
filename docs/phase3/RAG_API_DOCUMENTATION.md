# Jarvis v1 — Phase 3 REST API Specification

## 1. Hybrid Search & Context Endpoints

### `POST /api/knowledge/search`
- **Body**: `{ "query": "string", "top_k": 5, "user_role": "ROLE_FOUNDER" }`
- **Response**: Array of retrieved chunks with dense score, sparse score, RRF score, rerank score, and formatted citation.

### `POST /api/knowledge/retrieve`
- **Body**: `{ "query": "string", "top_k": 5, "user_role": "ROLE_FOUNDER" }`
- **Response**:
  ```json
  {
    "success": true,
    "found_context": true,
    "context_text": "[Source: partner-terms.md (v1.0) -> Partner terms -> Payment terms]\n## Payment terms\n- Net-30 from invoice date...",
    "estimated_tokens": 420,
    "citations": [
      "Source: partner-terms.md (v1.0) -> Partner terms -> Payment terms"
    ]
  }
  ```
- If no reliable sources are found, returns: `"I could not find a verified company source for this information."`

---

## 2. Source Management Endpoints

- `GET /api/knowledge/sources`: List registered documents with chunk counts and status.
- `GET /api/knowledge/sources/<source_id>`: Get source details and all its indexed chunks.
- `POST /api/knowledge/sources/ingest`: Trigger bulk ingestion (`{ "path": "notes" }`).

---

## 3. Candidate Fact Management Endpoints (Tier 2)

- `GET /api/knowledge/candidates`: List staged candidates (filterable by status).
- `POST /api/knowledge/candidates/<candidate_id>/approve`: Promote candidate to Tier 3 global memory (`{ "reviewer_id": "...", "reviewer_role": "ROLE_FOUNDER", "comments": "..." }`).
- `POST /api/knowledge/candidates/<candidate_id>/reject`: Reject candidate.

---

## 4. Global Memory Endpoints (Tier 3)

- `GET /api/knowledge/memory`: List approved global company facts.
- `GET /api/knowledge/stats`: Summary counts for the Knowledge Base dashboard.
