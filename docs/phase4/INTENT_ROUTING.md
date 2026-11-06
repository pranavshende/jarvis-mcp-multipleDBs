# Jarvis v1 — Intent Router & Dispatch Architecture

The Intent Router (`gateway/src/orchestrator/intent_router.ts`) serves as the central brain of the Jarvis Gateway, parsing natural language queries into verified operational actions without hallucination.

---

## 1. The Three Routing Paths

### PATH A — BUSINESS METRIC ROUTE
- **Trigger:** Queries asking for counts, balances, dollar values, rates, or aging summaries.
- **Example:** *"What is our current partner AR aging breakdown?"*
- **Execution:**
  1. Identifies deterministic metric (`PARTNER_AR_AGING`).
  2. Validates parameters.
  3. Invokes `get_partner_ar_aging` via `services.metrics_engine`.
  4. Returns certified SQL result with exact calculation timestamp.

### PATH B — DOCUMENT KNOWLEDGE ROUTE
- **Trigger:** Queries asking for SOPs, guidelines, policies, contracts, or incident post-mortems.
- **Example:** *"What are our standard partner payment terms?"*
- **Execution:**
  1. Identifies knowledge inquiry.
  2. Invokes `search_company_knowledge` via Phase 3 single-CTE hybrid search.
  3. Returns retrieved chunks with mandatory source citations (`Source: partner-terms.md (v1.0) -> Partner terms -> Payment terms`).

### PATH C — DUAL SYNTHESIS ROUTE
- **Trigger:** Complex operational questions requiring both live metrics and governing policies.
- **Example:** *"What are our partner AR aging balances and what payment terms SOPs apply to them?"*
- **Execution:**
  1. Concurrently queries live metric (`PARTNER_AR_AGING`).
  2. Concurrently queries company policy knowledge (`search_company_knowledge`).
  3. Synthesizes both into a unified response, explicitly delineating certified metrics from company policies.

---

## 2. Restricted Action Safety Intercept
If a user query asks Jarvis to execute a mutation (e.g. *"Place Riverbend Comics on credit hold"*):
- Intent Router intercepts the request.
- Informs the user that restricted actions require a two-step workflow:
  1. Call `propose_business_action` to inspect parameters and generate a confirmation token.
  2. Call `confirm_business_action` with the exact human confirmation token phrase (`CONFIRM ACTION_CREDIT_HOLD`).
- Autonomous execution from a plain conversational prompt is strictly prevented.
