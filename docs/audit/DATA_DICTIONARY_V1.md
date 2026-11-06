# Meridian Supply Chain — Data Dictionary V1
**Forensic Database Schema Audit for Jarvis v1**
*Scope: seller_db (10 tables), wms_db (9 tables), portal_db (16 tables)*
*Source Data: PostgreSQL pg_dump exports + CSV snapshot (2026-10-20)*
*Author: Principal Software Architect & Database Security Engineer*

---

## 1. Executive Summary & Replication Boundary

Meridian Supply Chain runs on three physically independent PostgreSQL databases with zero shared foreign keys.
To support Jarvis v1 without degrading production throughput or compromising sensitive data, Phase 0 establishes an explicit **Replication Boundary**:

1. **Eligible for Replication**: Operational facts, catalog dimensions, order transactions, dock scans, and inspection logs.
2. **Strictly Excluded / Quarantined**:
   - `seller_db.payout_methods`: Contains raw member banking details (`ach_account_number`, `ach_routing_number`). Excluded at ingestion; only last 4 digits are accessible.
   - `finance/restricted/payroll_summary.csv`: Contains Gusto individual employee salaries and compensation. Structurally excluded from the analytics database.
   - `notes/founder_private/`: Confidential founder documents. Never ingested into shared memory.

---

## 2. seller_db Schema Audit (Django Backend · 10 Tables)

### 2.1 `members` (6,000 Rows · 14 Columns)
- **Primary Key**: `member_id` (integer)
- **Description**: Independent individual sellers who supply sealed collectibles to MSC.
- **Columns**:
  - `member_id` (int, NOT NULL) — Unique seller account identifier.
  - `discord_handle` (text) — Member handle in Discord community.
  - `email` (text, NOT NULL) — Seller email address (PII).
  - `full_name` (text) — Legal seller name (PII).
  - `phone` (text) — Phone contact (PII).
  - `address_line1`, `address_line2`, `city`, `state`, `postal_code` (text) — Shipping origin (PII).
  - `tier` (text) — Seller loyalty tier (`standard`, `bronze`, `silver`, `gold`).
  - `status` (text) — Account state (`active`, `suspended`, `flagged`).
  - `payout_notes` (text) — Free-text internal notes written by member support (Hannah Cole/Maya Singh).
  - `created_at` (timestamptz) — Registration timestamp (UTC).
- **Sensitivity**: **CONFIDENTIAL (PII)**. Mask email and phone in general analytics.
- **Replication Action**: REPLICATE WITH PII MASKING (`email_hash`, masked phone).

### 2.2 `payout_methods` (6,000 Rows · 9 Columns)
- **Primary Key**: `method_id` (integer)
- **Foreign Key**: `member_id` -> `members.member_id`
- **Description**: Payment routing profiles for member cashouts.
- **Columns**:
  - `method_id` (int, NOT NULL) — Primary key.
  - `member_id` (int, NOT NULL) — Seller foreign key.
  - `method` (text, NOT NULL) — Cashout channel (`ach`, `paypal`, `wallet`).
  - `paypal_email` (text) — PayPal destination email (PII).
  - `ach_bank_name` (text) — Receiving bank name (e.g., Chase, Wells Fargo).
  - `ach_account_last4` (char(4)) — Safe display digits.
  - `ach_routing_number` (text) — **CRITICAL SENSITIVE BANKING DATA**.
  - `ach_account_number` (text) — **CRITICAL SENSITIVE BANKING DATA**.
  - `is_default` (boolean) — Active status.
- **Sensitivity**: **RESTRICTED (BANKING DATA)**.
- **Replication Action**: **EXCLUDE ENTIRE TABLE**. Ingest only `ach_account_last4` into `dim_members`. Drop routing and full account numbers at ETL source.

### 2.3 `buy_list` (520 Rows · 7 Columns)
- **Primary Key**: `seller_sku` (text)
- **Description**: Current prices MSC offers to pay members for sealed products ("pre-quotes").
- **Columns**:
  - `seller_sku` (text, NOT NULL) — MSC seller SKU.
  - `product_name` (text, NOT NULL) — Description of sealed box/case.
  - `brand` (text) — Card game brand (e.g. Arcane Realms, Starbound Duel).
  - `set_name` (text) — Expansion set title.
  - `buy_price` (numeric(10,2), NOT NULL) — Current cash purchase offer.
  - `active` (boolean) — Active listing flag.
  - `updated_at` (timestamptz) — Last pricing adjustment (UTC).
- **Sensitivity**: INTERNAL. Safe to replicate.

### 2.4 `buy_list_changes` (1,842 Rows · 7 Columns)
- **Primary Key**: `change_id` (integer)
- **Description**: Audit log of historical buy price adjustments.
- **Columns**: `change_id`, `seller_sku`, `old_price`, `new_price`, `changed_by`, `changed_at`, `reason`.
- **Replication Action**: REPLICATE FULLY.

### 2.5 `submissions` (4,210 Rows · 13 Columns)
- **Primary Key**: `submission_id` (text, e.g. `SUB-88192`)
- **Foreign Key**: `member_id` -> `members.member_id`
- **Description**: Inbound sell orders created by members.
- **Columns**: `submission_id`, `member_id`, `destination` (`EWR1` / `ONT1`), `carrier`, `tracking_number`, `status` (`pending_shipment`, `in_transit`, `delivered`, `received`, `inspected`, `paid`, `cancelled`), `box_count`, `total_quoted_amount`, `created_at`, `updated_at`.
- **Replication Action**: REPLICATE FULLY.

### 2.6 `submission_items` (9,412 Rows · 7 Columns)
- **Primary Key**: `item_id` (integer)
- **Foreign Key**: `submission_id` -> `submissions.submission_id`
- **Columns**: `item_id`, `submission_id`, `seller_sku`, `qty`, `quoted_unit_price`, `qty_accepted`, `qty_rejected`.
- **Replication Action**: REPLICATE FULLY.

### 2.7 `payouts` (3,680 Rows · 10 Columns)
- **Primary Key**: `payout_id` (text, e.g. `PO-88002`)
- **Foreign Key**: `submission_id` -> `submissions.submission_id`, `member_id` -> `members.member_id`
- **Description**: Member cash disbursements upon inspection completion.
- **Columns**:
  - `payout_id` (text, NOT NULL) — Primary key.
  - `member_id` (int), `submission_id` (text).
  - `method` (text) — `ach`, `paypal`, `wallet`.
  - `amount` (numeric(12,2)) — Cash disbursement value.
  - `status` (text) — `paid`, `pending`, `failed`, `on_hold`.
  - `initiated_at`, `paid_at` (timestamptz).
  - `ach_batch_id` (text, nullable) — Bank NACHA batch identifier.
  - `failure_reason` (text, nullable) — Bank return code/error message.
- **Replication Action**: REPLICATE FULLY (Essential for Payout Failure Alert Engine).

### 2.8 `wallet_ledger` (1,240 Rows · 7 Columns)
- **Primary Key**: `entry_id` (integer)
- **Columns**: `entry_id`, `member_id`, `created_at`, `entry_type` (`credit`, `debit`, `cashout`), `amount`, `balance_after`, `reference_id`.
- **Replication Action**: REPLICATE FULLY.

### 2.9 `support_tickets` (2,150 Rows · 11 Columns)
- **Primary Key**: `ticket_id` (text, e.g. `TCK-1092`)
- **Columns**: `ticket_id`, `member_id`, `discord_channel_id`, `category`, `subject`, `body`, `status`, `assigned_to`, `created_at`, `resolved_at`.
- **Sensitivity**: INTERNAL (Contains seller text; scan for PII/banking before vectorization).
- **Replication Action**: REPLICATE FULLY.

### 2.10 `staff_users` (12 Rows · 4 Columns)
- **Primary Key**: `user_id` (integer)
- **Columns**: `user_id`, `email`, `name`, `role`.
- **Replication Action**: REPLICATE FULLY.

---

## 3. wms_db Schema Audit (Ruby on Rails Backend · 9 Tables)

### 3.1 `warehouses` (2 Rows · 5 Columns)
- **Primary Key**: `warehouse_id` (integer)
- **Records**:
  1. `EWR1`: East Warehouse, Edison, NJ · Timezone: `America/New_York` · Shift: 09:00–21:00 EDT
  2. `ONT1`: West Warehouse, Ontario, CA · Timezone: `America/Los_Angeles` · Shift: 07:00–19:00 PDT
- **Columns**: `warehouse_id`, `code`, `name`, `timezone`, `address`.
- **Replication Action**: REPLICATE FULLY.

### 3.2 `wms_items` (480 Rows · 8 Columns)
- **Primary Key**: `item_id` (text, e.g. `ITM-991`)
- **Description**: Physical warehouse inventory master catalog.
- **Columns**:
  - `item_id` (text, NOT NULL) — Internal WMS SKU identifier.
  - `upc` (char(12), nullable) — Standard 12-digit UPC barcode. (Note: Only ~52% populated!).
  - `description` (text) — Product description.
  - `category` (text) — Category (`tcg`, `sports`, `bullion`, `coins`).
  - `avg_paid_180d` (numeric(10,2)) — Rolling 180-day average cost per unit used by Ops.
  - `avg_paid_refreshed_at` (timestamptz).
  - `active` (boolean).
- **Replication Action**: REPLICATE FULLY into `dim_product_crosswalk`.

### 3.3 `bins` (1,200 Rows · 5 Columns)
- **Primary Key**: `bin_id` (text)
- **Columns**: `bin_id`, `warehouse_id`, `zone`, `aisle`, `shelf`.
- **Replication Action**: REPLICATE FULLY.

### 3.4 `inbound_packages` (3,840 Rows · 10 Columns)
- **Primary Key**: `package_id` (integer)
- **Description**: Physical cartons scanned at the dock intake stations.
- **Columns**:
  - `package_id` (int, NOT NULL) — Package serial.
  - `warehouse_id` (int, NOT NULL) — `1` (EWR1) or `2` (ONT1).
  - `carrier` (text) — `UPS`, `FedEx`, `USPS`.
  - `tracking_number` (text) — Barcode scan from carrier shipping label.
  - `sender_name` (text) — Name entered from shipping label.
  - `ref_note` (text, nullable) — Free text entered at dock (often contains `SUB-` number).
  - `received_at` (timestamptz, NOT NULL) — Scan timestamp stored in UTC.
  - `status` (text) — `received`, `inspecting`, `inspected`, `quarantined`.
  - `inspected_at` (timestamptz, nullable).
  - `inspected_by` (text, nullable) — Name of inspection specialist (e.g. Nora Byrne, Ravi Patel).
- **Replication Action**: REPLICATE FULLY (Foundation of daily receiving metrics).

### 3.5 `package_lines` (8,920 Rows · 10 Columns)
- **Primary Key**: `line_id` (integer)
- **Foreign Key**: `package_id` -> `inbound_packages.package_id`, `item_id` -> `wms_items.item_id`
- **Columns**: `line_id`, `package_id`, `item_id`, `qty_expected`, `qty_received`, `qty_passed`, `qty_failed`, `failure_reason`, `created_at`, `updated_at`.
- **Replication Action**: REPLICATE FULLY (Provides actual physical unit intake counts).

### 3.6 `stock_levels` (960 Rows · 7 Columns)
- **Primary Key**: (`item_id`, `warehouse_id`)
- **Columns**: `item_id`, `warehouse_id`, `bin_id`, `qty_on_hand`, `qty_reserved`, `qty_damaged`, `updated_at`.
- **Formula**: $\text{Available to Sell} = \text{qty\_on\_hand} - \text{qty\_reserved}$.
- **Replication Action**: REPLICATE FULLY.

### 3.7 `outbound_shipments` (1,150 Rows · 10 Columns)
- **Primary Key**: `shipment_id` (text, e.g. `SH-8819`)
- **Columns**: `shipment_id`, `warehouse_id`, `order_ref`, `carrier`, `tracking_number`, `ship_to_name`, `status`, `shipped_at`, `created_at`.
- **Replication Action**: REPLICATE FULLY.

### 3.8 `outbound_lines` (2,410 Rows · 3 Columns)
- **Columns**: `shipment_id`, `item_id`, `qty`.
- **Replication Action**: REPLICATE FULLY.

### 3.9 `wms_users` (16 Rows · 4 Columns)
- **Primary Key**: `username` (text)
- **Columns**: `username`, `name`, `role`, `warehouse_id`.
- **Replication Action**: REPLICATE FULLY.

---

## 4. portal_db Schema Audit (Next.js Backend · 16 Tables)

### 4.1 `brands` (10 Rows · 3 Columns) & `sets` (60 Rows · 4 Columns)
- Master taxonomy: Brand (e.g. Arcane Realms, Starbound Duel) -> Set (e.g. Ember Throne, Nebula Rising).
- **Replication Action**: REPLICATE FULLY.

### 4.2 `catalog_products` (480 Rows · 7 Columns)
- **Primary Key**: `product_id` (text, e.g. `PRD-102`)
- **Columns**: `product_id`, `set_id`, `name`, `mfr_code`, `list_price`, `status`, `created_at`.
- **Critical Finding**: `mfr_code` contains manufacturer SKU strings (e.g. `SD-IONST-PRK`). Only 52% match WMS item records directly.
- **Replication Action**: REPLICATE FULLY into `dim_product_crosswalk`.

### 4.3 `listed_stock` (480 Rows · 6 Columns)
- **Primary Key**: `product_id` (text)
- **Columns**: `product_id`, `available_qty`, `last_synced_at`, `manual_override`, `override_by`, `override_note`.
- **Replication Action**: REPLICATE FULLY.

### 4.4 `partners` (400 Rows · 10 Columns)
- **Primary Key**: `partner_id` (integer, e.g. `301` = Northgate Hobby Distributors)
- **Description**: Wholesale B2B card shops, distributors, and live breakers.
- **Columns**:
  - `partner_id` (int, NOT NULL) — Primary key.
  - `name` (text, NOT NULL) — Legal business name.
  - `partner_type` (text) — `distributor`, `hobby_shop`, `live_seller`.
  - `state` (char(2)).
  - `payment_terms` (text) — Standard is `net_30`.
  - `credit_limit` (numeric(12,2)) — Approved credit exposure (e.g., $250,000 for Northgate).
  - `tier` (text) — `standard`, `silver`, `gold`.
  - `account_manager` (text) — Assigned sales lead (e.g., `sofia@meridiansc.com`).
  - `status` (text) — `active`, `credit_hold`, `inactive`.
  - `created_at` (timestamptz).
- **Replication Action**: REPLICATE FULLY into `dim_partners`.

### 4.5 `partner_users` (620 Rows · 6 Columns)
- **Columns**: `user_id`, `partner_id`, `name`, `email`, `role`, `last_login_at`.
- **Replication Action**: REPLICATE WITH PII MASKING.

### 4.6 `quotes` (2,100 Rows) & `quote_items` (4,800 Rows)
- Partner quote negotiations, discounts, and 72-hour validity windows.
- **Replication Action**: REPLICATE FULLY.

### 4.7 `orders` (1,150 Rows · 7 Columns)
- **Primary Key**: `order_id` (text, format: `SO-41234`)
- **Columns**: `order_id`, `partner_id`, `quote_id`, `status`, `fulfillment_warehouse`, `created_at`, `updated_at`.
- **Replication Action**: REPLICATE FULLY into `fact_orders`.

### 4.8 `order_items` (2,410 Rows · 5 Columns)
- **Columns**: `order_item_id`, `order_id`, `product_id`, `qty`, `unit_price`.
- **Replication Action**: REPLICATE FULLY.

### 4.9 `invoices` (1,147 Rows · 8 Columns)
- **Primary Key**: `invoice_id` (text, format: `INV-22139`)
- **Foreign Key**: `order_id` -> `orders.order_id`, `partner_id` -> `partners.partner_id`
- **Columns**:
  - `invoice_id` (text, NOT NULL).
  - `order_id` (text), `partner_id` (int).
  - `issued_at` (timestamptz), `due_date` (date).
  - `amount` (numeric(12,2)) — Total invoice balance.
  - `status` (text) — `paid`, `open`, `overdue`.
  - `amount_paid` (numeric(12,2)).
- **Replication Action**: REPLICATE FULLY into `fact_invoices`.

### 4.10 `payments` (980 Rows · 6 Columns)
- **Columns**: `payment_id`, `invoice_id`, `partner_id`, `amount`, `method` (`wire`, `ach`, `check`), `received_at`.
- **Replication Action**: REPLICATE FULLY.

### 4.11 `market_prices` (5,320 Rows · 5 Columns)
- **Columns**: `set_id`, `price_date`, `median_box_price`, `active_listings`, `sold_7d`.
- **Replication Action**: REPLICATE FULLY (Essential for inventory margin inversion checks).

### 4.12 `price_index` (90 Rows · 5 Columns)
- **Columns**: `index_date`, `msc_sealed_index`, `tcg_index`, `sports_index`, `bullion_index`.
- **Replication Action**: REPLICATE FULLY.

---

## 5. Master Replication Matrix

| Source Database | Table Name | Ingestion Action | Transformation / Masking Rules |
|---|---|---|---|
| `seller_db` | `members` | REPLICATE | Mask email (`email_hash`), mask phone, remove physical street address. |
| `seller_db` | `payout_methods` | **EXCLUDE** | **DROP TABLE ENTIRELY**. Only extract `ach_account_last4` into member dimension. |
| `seller_db` | `buy_list`, `buy_list_changes` | REPLICATE | None. Direct copy. |
| `seller_db` | `submissions`, `submission_items`| REPLICATE | None. Direct copy. |
| `seller_db` | `payouts` | REPLICATE | None. Maintain failure reasons for alert engine. |
| `seller_db` | `support_tickets` | REPLICATE | PII regex pass before storage. |
| `wms_db` | `warehouses`, `bins` | REPLICATE | None. |
| `wms_db` | `wms_items` | REPLICATE | Load into Canonical Crosswalk (`dim_product_crosswalk`). |
| `wms_db` | `inbound_packages`, `package_lines`| REPLICATE | Timezone conversion to local dock dates. |
| `wms_db` | `stock_levels` | REPLICATE | None. |
| `wms_db` | `outbound_shipments`, `lines` | REPLICATE | Strip hyphens from order reference strings. |
| `portal_db` | `brands`, `sets` | REPLICATE | None. |
| `portal_db` | `catalog_products`, `listed_stock`| REPLICATE | Load into Canonical Crosswalk (`dim_product_crosswalk`). |
| `portal_db` | `partners` | REPLICATE | Load into `dim_partners`. |
| `portal_db` | `orders`, `order_items` | REPLICATE | Normalize `order_id` string formatting. |
| `portal_db` | `invoices`, `payments` | REPLICATE | Calculate dynamic `days_overdue` and aging buckets. |
| `portal_db` | `market_prices`, `price_index` | REPLICATE | Join with sets for inventory mark-to-market valuations. |
