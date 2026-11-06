# -*- coding: utf-8 -*-
"""
Canonical Identity & Product Crosswalk Service.
Provides Tier 1-4 product resolution and normalized order reference matching.
"""
from services.db_pool import get_db_connection
import psycopg2.extras
import re

def normalize_order_id(order_ref):
    """Normalizes order reference by stripping all non-alphanumeric characters."""
    if not order_ref:
        return ""
    return re.sub(r'[^A-Za-z0-9]', '', str(order_ref)).upper()

def get_crosswalk_stats():
    with get_db_connection(read_only=True) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    mapping_method,
                    mapping_confidence,
                    COUNT(*) AS count
                FROM analytics.dim_product_crosswalk
                GROUP BY mapping_method, mapping_confidence
                ORDER BY mapping_confidence DESC;
            """)
            stats = cur.fetchall()
            
            cur.execute("SELECT COUNT(*) FROM analytics.dim_product_crosswalk;")
            total = cur.fetchone()["count"]
            
            return {
                "total_catalog_items": total,
                "breakdown": [dict(s) for s in stats]
            }

def search_product_crosswalk(query=None, limit=20):
    with get_db_connection(read_only=True) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if query:
                sql = """
                    SELECT * FROM analytics.dim_product_crosswalk
                    WHERE canonical_name ILIKE %(q)s
                       OR canonical_sku ILIKE %(q)s
                       OR wms_upc ILIKE %(q)s
                       OR portal_mfr_code ILIKE %(q)s
                    LIMIT %(limit)s;
                """
                cur.execute(sql, {"q": f"%{query}%", "limit": limit})
            else:
                sql = "SELECT * FROM analytics.dim_product_crosswalk LIMIT %(limit)s;"
                cur.execute(sql, {"limit": limit})
            
            rows = cur.fetchall()
            return [dict(r) for r in rows]

def resolve_order(order_id_input):
    normalized = normalize_order_id(order_id_input)
    with get_db_connection(read_only=True) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            sql = """
                SELECT 
                    o.order_id AS portal_order_id,
                    o.partner_id,
                    o.status AS portal_status,
                    s.shipment_id AS wms_shipment_id,
                    s.order_ref AS wms_order_ref,
                    s.tracking_number,
                    s.status AS shipment_status,
                    s.shipped_at
                FROM staging_portal.orders o
                FULL OUTER JOIN staging_wms.outbound_shipments s 
                  ON REGEXP_REPLACE(o.order_id, '[^A-Za-z0-9]', '', 'g') = REGEXP_REPLACE(s.order_ref, '[^A-Za-z0-9]', '', 'g')
                WHERE REGEXP_REPLACE(COALESCE(o.order_id, s.order_ref), '[^A-Za-z0-9]', '', 'g') = %(norm)s
                LIMIT 1;
            """
            cur.execute(sql, {"norm": normalized})
            row = cur.fetchone()
            if row:
                return {
                    "matched": True,
                    "normalized_query": normalized,
                    "data": dict(row)
                }
            return {
                "matched": False,
                "normalized_query": normalized,
                "message": f"No order found matching '{order_id_input}'"
            }
