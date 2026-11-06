# Jarvis v1 — React Knowledge Management Interface

## 1. Overview

The Knowledge Management Interface (`client/src/components/KnowledgeBase.jsx`) is integrated as a top-level tab in the React 18 frontend (`port 3001`).

---

## 2. Integrated Screens

1. **RAG Search Playground**:
   - Interactive search bar with pre-configured example queries.
   - Formatted LLM-ready RAG context display with clickable citations.
   - Chunks comparison table detailing dense cosine score, sparse full-text rank, RRF score, and reranker score.

2. **Document Library**:
   - Table of all 110 registered company documents.
   - Search filter by title and filename.
   - Status indicators (`INDEXED`, `QUARANTINED`).
   - "View Chunks" modal inspecting chunks and tokens.

3. **Candidate Review Panel (Tier 2)**:
   - Live queue of facts staged from team AI sessions.
   - Corroboration counter.
   - Contradiction warnings highlighting conflicting policy facts.
   - Human review buttons ("Approve to Global Memory", "Reject").

4. **Global Memory Explorer (Tier 3)**:
   - Approved company facts with category tags, confidence scores, approver identity, and approval dates.
