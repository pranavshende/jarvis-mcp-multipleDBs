-- ============================================================================
-- CANONICAL PRODUCT & ENTITY CROSSWALK DEFINITIONS
-- Schema: analytics
-- Target: Supabase Managed PostgreSQL
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

-- 1. Canonical Product Crosswalk Table
CREATE TABLE IF NOT EXISTS analytics.dim_product_crosswalk (
    canonical_product_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    canonical_sku VARCHAR(64) NOT NULL UNIQUE,
    canonical_name VARCHAR(255) NOT NULL,
    set_code VARCHAR(32),
    brand_name VARCHAR(64),
    portal_catalog_id VARCHAR(64) UNIQUE,
    portal_mfr_code VARCHAR(64),
    wms_item_id VARCHAR(64) UNIQUE,
    wms_upc VARCHAR(32),
    mapping_confidence NUMERIC(3, 2) NOT NULL CHECK (mapping_confidence >= 0.00 AND mapping_confidence <= 1.00),
    mapping_method VARCHAR(32) NOT NULL CHECK (mapping_method IN ('EXACT_UPC', 'CURATED_MAP', 'FUZZY_NORMALIZED', 'MANUAL_PENDING')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices for low-latency point lookups across heterogeneous IDs
CREATE INDEX IF NOT EXISTS idx_prod_crosswalk_canonical_sku ON analytics.dim_product_crosswalk(canonical_sku);
CREATE INDEX IF NOT EXISTS idx_prod_crosswalk_wms_upc ON analytics.dim_product_crosswalk(wms_upc);
CREATE INDEX IF NOT EXISTS idx_prod_crosswalk_portal_mfr_code ON analytics.dim_product_crosswalk(portal_mfr_code);
CREATE INDEX IF NOT EXISTS idx_prod_crosswalk_portal_catalog_id ON analytics.dim_product_crosswalk(portal_catalog_id);
CREATE INDEX IF NOT EXISTS idx_prod_crosswalk_wms_item_id ON analytics.dim_product_crosswalk(wms_item_id);

-- Quarantine index for unmapped or ambiguous items requiring human review
CREATE INDEX IF NOT EXISTS idx_prod_crosswalk_quarantine 
ON analytics.dim_product_crosswalk(canonical_product_id) 
WHERE mapping_confidence < 0.70;

-- 2. Automated Updated-At Trigger
CREATE OR REPLACE FUNCTION analytics.trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_dim_product_crosswalk ON analytics.dim_product_crosswalk;
CREATE TRIGGER set_timestamp_dim_product_crosswalk
BEFORE UPDATE ON analytics.dim_product_crosswalk
FOR EACH ROW
EXECUTE FUNCTION analytics.trigger_set_timestamp();

-- 3. Sanitized View for Low-Clearance Consumers (Contractors / Temp Scanners)
CREATE OR REPLACE VIEW analytics.v_scanner_product_lookup AS
SELECT 
    canonical_product_id,
    canonical_sku,
    canonical_name,
    set_code,
    wms_upc,
    mapping_confidence
FROM analytics.dim_product_crosswalk
WHERE is_active = TRUE;

-- 4. Facility Reference Dimension
CREATE TABLE IF NOT EXISTS analytics.dim_facilities (
    facility_code VARCHAR(16) PRIMARY KEY,
    facility_name VARCHAR(64) NOT NULL,
    state VARCHAR(2) NOT NULL,
    iana_timezone VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO analytics.dim_facilities (facility_code, facility_name, state, iana_timezone)
VALUES 
    ('FAC-01', 'Warehouse East (Breinigsville)', 'PA', 'America/New_York'),
    ('FAC-02', 'Warehouse West (Reno)', 'NV', 'America/Los_Angeles')
ON CONFLICT (facility_code) DO UPDATE 
SET iana_timezone = EXCLUDED.iana_timezone;
