# Jarvis v1 — Three-Tier Knowledge Governance

## 1. Governance Principles

The core directive of Phase 3 is:
> **Jarvis may learn from conversations, but it must never treat every conversation as company truth.**

---

## 2. The Three Tiers

### Tier 1 — Private Session Scope
- Raw conversation transcripts and thoughts remain strictly isolated to the originating user.
- Stored exclusively in local/private session stores.
- Never embedded into `document_chunks` or returned to other users.

### Tier 2 — Staged Candidates (`jarvis_memory.session_candidates`)
- Extracted potential facts from opted-in team members (`arjun`, `dana`, `hannah`, `kenji`, `leo`, `marcus`, `priya`, `sofia`).
- Tagged with `originating_user_id`, `source_session_id`, `corroboration_count`, and `status`.
- Visible only to authorized reviewers (`ROLE_FOUNDER`, domain leads).

### Tier 3 — Promoted Global Memory (`jarvis_memory.memory_facts`)
A candidate fact can enter global memory **only** through one of two strict conditions:
1. **Explicit Domain Lead Approval**: Approved by the designated lead (e.g. Sofia for Partner Terms, Kenji for Finance).
2. **3x Independent Corroboration**: Stated independently by at least 3 distinct users without active contradictions. Two users cannot satisfy this rule.

---

## 3. Contradiction Detection & Memory Poisoning Defense

When a candidate fact contradicts an existing canonical fact (e.g., claiming a partner is on "net-90" when approved policy specifies "net-30"):
- The existing approved fact remains 100% authoritative.
- The candidate is flagged with `status = 'CONFLICTING'`.
- `conflict_with_fact_id` and conflict details are recorded.
- System rejects automatic promotion and routes the conflict to the domain lead for manual review.
- All decisions are recorded in `jarvis_memory.memory_approvals`.
