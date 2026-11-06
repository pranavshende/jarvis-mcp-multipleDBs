# Jarvis v1 — Phase 3 Security Review & Threat Model

## 1. Threat Matrix & Implemented Defenses

| Threat Vector | Risk Description | Phase 3 Safeguard |
|---|---|---|
| **Memory Poisoning** | Conversational claims claiming net-90 payment terms or altered policies | **Three-Tier Governance**: Unapproved claims remain in Tier 2. Contradiction detector flags conflicts against Tier 3 and preserves canonical Net-30 policy. |
| **PII & Sensitive Leakage** | SSNs, credit cards, bank accounts, or payroll leaking into embeddings | **Deterministic Pre-Sanitizer**: Regex + NER replaces sensitive values with placeholders. Verified across 100 automated test cases. |
| **Founder-Private Exposure** | Executive notes and acquisition discussions surfacing to general staff | **Quarantine Boundary**: Any path or file listed in `notes/founder_private/INDEX.md` is quarantined from shared embeddings. |
| **Indirect Prompt Injection** | Malicious text in ingested documents hijacking LLM execution | **Untrusted Context Framing**: RAG context is formatted as untrusted passive reference data with explicit citation tags. |
| **Unauthorized Promotion** | Non-privileged staff approving candidate facts | **Role Verification**: Server-side role checks require `ROLE_FOUNDER` or authorized domain leads. All actions recorded in immutable audit log. |
