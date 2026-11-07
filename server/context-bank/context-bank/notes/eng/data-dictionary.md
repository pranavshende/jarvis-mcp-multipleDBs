# Data dictionary (partial)

_Last updated 2026-04 by Leo. Some of this is out of date._

## seller_db
- `members` — one row per account (not per person). `payout_notes` is free text written by support.
- `payout_methods` — current payout method; bank account last 4 only.
- `buy_list` / `buy_list_changes` — current price and history of changes.
- `submissions` / `submission_items` — member sell orders. `destination` is the warehouse code.
- `payouts` — one per submission when inspection completes. `status`: pending / paid / failed / on_hold.
- `wallet_ledger`, `support_tickets`.

## wms_db
- `inbound_packages` — one row per physical box. `received_at` UTC. `ref_note` free text (often SUB number).
- `package_lines` — per product per box: expected/received/passed/failed.
- `stock_levels` — per item per warehouse. `qty_on_hand` includes reserved.
- `wms_items` — WMS product master. `avg_paid_180d` (ops).
- `outbound_shipments` / `outbound_lines`. `order_ref` like `SO41234` (no dash).

## portal_db
- `catalog_products` — portal product master. Some old duplicate listings still exist (status inactive).
- `listed_stock` — what partners see.
- `quotes`, `orders`, `invoices`, `payments`, `partner_messages`, `market_prices`, `price_index`.

## Joins
- Submission ↔ package: `submissions.tracking_number = inbound_packages.tracking_number` (manual entry at the dock,
  so expect typos), or `ref_note`.
- WMS item ↔ portal product: `wms_items.upc = catalog_products.mfr_code` when mfr_code is filled (about half),
  otherwise by name (names differ in format), or via `ops-scripts/mappings/item_map.csv` (not in this export).
- Seller SKU ↔ anything: by name only.

## Units query
```sql
select received_at::date, sum(qty_received) from package_lines l
join inbound_packages p using (package_id) group by 1 order by 1;
```
