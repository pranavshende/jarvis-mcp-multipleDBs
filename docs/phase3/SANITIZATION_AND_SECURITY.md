# Jarvis v1 — Sanitization & Sensitive Data Redaction

## 1. Zero Sensitive Leakage Standard

The Document Sanitizer (`server/services/rag/sanitizer.py`) runs as a mandatory pre-processor before any text is chunked or vectorized.

---

## 2. Redaction Categories & Placeholders

| Sensitive Category | Detection Logic | Replacement Placeholder |
|---|---|---|
| **Social Security Numbers** | 3-2-4 digits with dashes/spaces | `[REDACTED_SSN]` |
| **Credit Card Numbers** | Visa, MC, Amex (4-6-5), Discover (13-19 digits) | `[REDACTED_CREDIT_CARD]` |
| **Bank Account Numbers** | Contextual account numbers (checking, savings, deposit) | `[REDACTED_BANK_ACCOUNT]` |
| **Bank Routing Numbers** | 9-digit ABA routing numbers preceded by routing/ABA | `[REDACTED_ROUTING_NUMBER]` |
| **Compensation & Payroll** | Salaries, hourly rates, executive bonuses | `[REDACTED_COMPENSATION]` |
| **API Keys & Secrets** | OpenAI `sk-`, GitHub `ghp_`, Slack `xox-`, AWS `AKIA`, JWTs | `[REDACTED_SECRET]` |
| **Founder-Private Topics** | Files indexed in `notes/founder_private/INDEX.md` | **QUARANTINED** |

---

## 3. Automated Test Verification: 100 Test Cases

The test suite in `server/tests/test_phase3_sanitizer_100.py` verified 100 realistic, contextual test cases:
- 15 SSN variations
- 15 Credit Card variations
- 15 Bank Account variations
- 15 Bank Routing number variations
- 15 Compensation & payroll variations
- 15 API key and secret token variations
- 10 Founder-private file paths and topics

**Test Outcome**: **100/100 PASSED (Zero sensitive value leaks detected).**
