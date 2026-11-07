# Systems & tools

| Tool | What for | Owner | Notes |
|---|---|---|---|
| Seller site (`seller_db`, Django) | Members, buy list, submissions, payouts | Arjun | Oldest app. Admin at /staff. |
| WMS (`wms_db`, Rails) | Receiving, inspection, stock, outbound | Arjun / Leo | Dock scanners post to `/api/v1/scans`. Times stored UTC. |
| Partners portal (`portal_db`, Next.js + Postgres) | Catalog, quotes, orders, invoices | Felix (front), Arjun (API) | Stock comes from WMS via `stock-sync`. |
| QuickBooks Online | Books, AR/AP | Kenji, Lucia | FIFO inventory via cost-layer export. |
| Gusto | Payroll | Kenji | Restricted. |
| Discord | Member community + tickets | Hannah | Ticket bot writes to `seller_db.support_tickets`. |
| Slack | Internal chat | everyone | #ops, #west, #finance, #eng, #partners, #jarvis |
| Linear | Engineering & ops tickets | Arjun | Team keys: ENG, OPS. |
| GitHub | Code | Arjun | Repos: seller-site, wms, partner-portal, ops-scripts, jarvis |
| Google Workspace | Docs, Sheets, email | Sam | Most SOPs mirrored in this notes folder. |
| Jarvis (v0) | Company brain experiment | Arjun | Slack bot + memory file. See `jarvis_v0/`. |

## AI tools in use
Claude (desktop + Claude Code), ChatGPT (Team), Codex, Gemini CLI, Cursor. Everyone has at least one seat.
Spend is tracked under "AI tools" in QuickBooks. See `company/how-we-use-ai.md`.

## Hosting
- Prod apps on AWS (us-east-1), one RDS Postgres instance with three databases.
- Jarvis v0 runs on a small Hetzner box in Falkenstein (EU) because it was cheap.
