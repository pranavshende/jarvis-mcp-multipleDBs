# API keys & service accounts

_Owner: Arjun · secrets live in 1Password "eng-shared"; this page lists what exists, not the values_

| Name | System | Scopes | Used by | Created |
|---|---|---|---|---|
| `seller-integration-prod` | Seller API | `members:read submissions:read submissions:write buylist:write payouts:write` | ops-scripts, Leo's notebooks, Jarvis v0 | 2024-02 |
| `seller-readonly` | Seller API | `members:read submissions:read` | — (created 2025-11, never rolled out) | 2025-11 |
| `wms-read` | WMS API | `items:read stock:read inbound:read` | stock-sync, Jarvis v0 | 2024-06 |
| `jarvis_svc` | Postgres | `SELECT` on all three databases (all tables) | Jarvis v0 | 2026-05 |
| `msc_readonly` | Postgres | `SELECT` on all three databases except `seller_db.payout_methods` | humans | 2025-01 |

Notes
- The integration key was meant to be split into read/write keys. Never happened.
- Rotate keys if a laptop is lost. Last rotation: 2025-09.
- Don't put keys in notebooks or `.env` files committed to git.
