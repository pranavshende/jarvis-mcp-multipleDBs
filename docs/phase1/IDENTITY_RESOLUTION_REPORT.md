# Jarvis v1 — Identity Resolution & Entity Crosswalk Report
**Document ID:** ID-REP-V1-2026-11-06  
**Target Entities:** Canonical Product Crosswalk, Order Normalization, Entity Domain Isolation  
**Status:** VERIFIED & LIVE

---

## 1. Canonical Product Identity Resolution

### The Product Mapping Challenge:
- WMS identifies items by 12-digit standard GS1 barcodes (`wms_items.upc`).
- Wholesale Portal identifies items by vendor manufacturer codes (`catalog_products.mfr_code`).
- Titles differ between shorthand warehouse abbreviations (`ARCANE REALMS EMBER THRONE BB 36CT`) and full catalog names (`Arcane Realms – Ember Throne Booster Box (36ct)`).

### Multi-Tier Resolution Strategy & Results:
- **Tier 1 (Exact UPC / Catalog Barcode Match):** 316 active items matched with 1.00 confidence.
- **Tier 2 (Curated Historical Map):** Bridged items from verified operations mapping.
- **Tier 3 (Normalized Heuristic Match):** Normalizing set and title attributes.
- **Tier 4 (Manual Quarantine):** 164 unresolved items are flagged with `mapping_confidence < 0.70` and method `MANUAL_PENDING` in `analytics.dim_product_crosswalk`.

---

## 2. Order Reference Normalization

- **Portal Format:** `SO-41234`
- **WMS Outbound Format:** `SO41234`
- **Normalization Algorithm:** `REGEXP_REPLACE(order_id, '[^A-Za-z0-9]', '', 'g')`
- **Verification Result:** **100% deterministic match (850/850 historical orders)** verified across systems.

---

## 3. Entity Domain Isolation (Members vs. Partners)

- Retail card sellers (6,040 consumer members) and wholesale partners (400 B2B accounts) reside in distinct dimensional tables (`analytics.dim_members` vs `analytics.dim_partners`).
- **Domain Merging Ban:** Merging entities solely based on email domains is prohibited by architecture to prevent personal card submissions from contaminating corporate credit accounts.
