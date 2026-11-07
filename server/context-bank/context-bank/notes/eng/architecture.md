# Architecture overview

_Owner: Arjun Mehta · 2026-05_

```
members ──> seller site (Django) ──> seller_db ─┐
                                                 │   ops-scripts (cron, Python)
dock scanners ──> WMS (Rails) ──> wms_db ───────┼──> stock-sync, layers export, nightly reports
                                                 │
partners ──> portal (Next.js) ──> portal_db ────┘
                                                      QuickBooks (manual import)
```

- One RDS instance, three databases, one app user per app (`seller_app`, `wms_app`, `portal_app`) plus
  `msc_readonly` for humans and `jarvis_svc` for Jarvis v0.
- No shared IDs. Cross-system joins are by tracking number (seller ↔ WMS inbound), by the mapping sheet
  (WMS item ↔ portal product), and by order ref string (portal order ↔ WMS outbound, `SO-123` vs `SO123`).
- Seller site has a REST API (`api/seller_api.yaml`), WMS has a read API (`api/wms_api.yaml`). The portal has no
  public API.
- All timestamps are stored in UTC (`timestamptz`). Apps render in the viewer's browser timezone except the WMS
  dashboards, which render UTC.
