# SOP — Portal stock sync

_Owner: Leo Fischer (job) / Sofia Lindqvist (business) · v1 · 2026-04-08_

The portal shows partners `listed_stock.available_qty`. That number is supposed to equal WMS
`qty_on_hand − qty_reserved`, summed over East and West.

## The job
- `stock-sync` runs every 15 minutes (cron on the ops-scripts box). It reads `wms_db.stock_levels`, maps WMS item →
  portal product using the mapping sheet (`ops-scripts/mappings/item_map.csv`) and writes `listed_stock`.
- It writes `last_synced_at` on every row it touches.
- If a product isn't in the mapping sheet, it's skipped silently.

## Manual overrides
Sales can set `manual_override = true` and type a number when we know stock is coming (e.g. a consignment). The job
skips overridden rows. **Remove the override when the stock lands.**

## Checks
- Sofia eyeballs top 20 SKUs on Monday.
- If a partner says "portal said in stock, you cancelled my order", check `last_synced_at` on that product.
