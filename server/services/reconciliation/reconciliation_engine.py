# -*- coding: utf-8 -*-
"""
Nightly Source-to-Analytics Reconciliation Engine.
Compares staging/source tables against analytics dimensional & fact tables,
detects discrepancies, verifies financial sums, and persists run history.
"""
from services.db_pool import get_db_connection
import psycopg2.extras
from datetime import datetime
import uuid
import logging

logger = logging.getLogger("jarvis.reconciliation")

RECONCILIATION_TARGETS = [
    {"source_db": "seller_db", "source_table": "staging_seller.members", "dest_table": "analytics.dim_members"},
    {"source_db": "portal_db", "source_table": "staging_portal.partners", "dest_table": "analytics.dim_partners"},
    {"source_db": "wms_db", "source_table": "staging_wms.warehouses", "dest_table": "analytics.dim_warehouses"},
    {"source_db": "wms_db", "source_table": "staging_wms.inbound_packages", "dest_table": "analytics.fact_dock_receipts"},
    {"source_db": "wms_db", "source_table": "staging_wms.package_lines", "dest_table": "analytics.fact_inspections"},
    {"source_db": "portal_db", "source_table": "staging_portal.orders", "dest_table": "analytics.fact_orders"},
    {"source_db": "portal_db", "source_table": "staging_portal.invoices", "dest_table": "analytics.fact_invoices"},
    {"source_db": "seller_db", "source_table": "staging_seller.payouts", "dest_table": "analytics.fact_payouts"},
    {"source_db": "wms_db", "source_table": "staging_wms.stock_levels", "dest_table": "analytics.fact_cost_layers"}
]

def init_reconciliation_table():
    with get_db_connection(read_only=False) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS analytics.reconciliation_logs (
                    reconciliation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    run_batch_id UUID NOT NULL,
                    source_database VARCHAR(64) NOT NULL,
                    source_table VARCHAR(128) NOT NULL,
                    destination_table VARCHAR(128) NOT NULL,
                    source_count INTEGER NOT NULL,
                    destination_count INTEGER NOT NULL,
                    discrepancy_count INTEGER NOT NULL,
                    financial_source_sum NUMERIC(16,2),
                    financial_dest_sum NUMERIC(16,2),
                    financial_variance NUMERIC(16,2),
                    status VARCHAR(32) NOT NULL,
                    started_at TIMESTAMPTZ NOT NULL,
                    completed_at TIMESTAMPTZ NOT NULL,
                    duration_ms INTEGER NOT NULL,
                    error_details TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_recon_logs_batch ON analytics.reconciliation_logs(run_batch_id);
                CREATE INDEX IF NOT EXISTS idx_recon_logs_status ON analytics.reconciliation_logs(status);
            """)
            conn.commit()

def run_reconciliation(mode="MANUAL_SNAPSHOT"):
    """
    Executes source-to-destination reconciliation.
    Mode: MANUAL_SNAPSHOT (compares staging to analytics) or NIGHTLY_AUTOMATED.
    """
    init_reconciliation_table()
    run_batch_id = str(uuid.uuid4())
    start_batch_time = datetime.now()
    results = []
    
    with get_db_connection(read_only=False) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            for target in RECONCILIATION_TARGETS:
                t_start = datetime.now()
                src_tbl = target["source_table"]
                dst_tbl = target["dest_table"]
                src_db = target["source_db"]
                
                try:
                    # 1. Compare row counts
                    cur.execute(f"SELECT COUNT(*) AS cnt FROM {src_tbl};")
                    src_count = cur.fetchone()["cnt"]
                    
                    cur.execute(f"SELECT COUNT(*) AS cnt FROM {dst_tbl};")
                    dst_count = cur.fetchone()["cnt"]
                    
                    discrepancy = abs(src_count - dst_count)
                    
                    # 2. Financial totals comparison where applicable
                    fin_src = None
                    fin_dst = None
                    fin_variance = None
                    
                    if "invoices" in src_tbl:
                        cur.execute(f"SELECT COALESCE(SUM(amount::numeric), 0) AS total FROM {src_tbl};")
                        fin_src = float(cur.fetchone()["total"])
                        cur.execute(f"SELECT COALESCE(SUM(amount), 0) AS total FROM {dst_tbl};")
                        fin_dst = float(cur.fetchone()["total"])
                        fin_variance = abs(fin_src - fin_dst)
                    elif "payouts" in src_tbl:
                        cur.execute(f"SELECT COALESCE(SUM(amount::numeric), 0) AS total FROM {src_tbl};")
                        fin_src = float(cur.fetchone()["total"])
                        cur.execute(f"SELECT COALESCE(SUM(amount), 0) AS total FROM {dst_tbl};")
                        fin_dst = float(cur.fetchone()["total"])
                        fin_variance = abs(fin_src - fin_dst)
                    
                    status = "MATCH"
                    error_detail = None
                    if discrepancy > 0:
                        status = "DISCREPANCY"
                        error_detail = f"Row count variance: {discrepancy} rows"
                    if fin_variance is not None and fin_variance > 0.01:
                        status = "DISCREPANCY"
                        error_detail = f"Financial variance: ${fin_variance:,.2f}"

                    t_end = datetime.now()
                    dur_ms = int((t_end - t_start).total_seconds() * 1000)
                    
                    # Insert into log table
                    cur.execute("""
                        INSERT INTO analytics.reconciliation_logs (
                            run_batch_id, source_database, source_table, destination_table,
                            source_count, destination_count, discrepancy_count,
                            financial_source_sum, financial_dest_sum, financial_variance,
                            status, started_at, completed_at, duration_ms, error_details
                        ) VALUES (
                            %(batch_id)s, %(src_db)s, %(src_tbl)s, %(dst_tbl)s,
                            %(src_cnt)s, %(dst_cnt)s, %(disc)s,
                            %(fin_src)s, %(fin_dst)s, %(fin_var)s,
                            %(status)s, %(start)s, %(end)s, %(dur)s, %(err)s
                        );
                    """, {
                        "batch_id": run_batch_id,
                        "src_db": src_db,
                        "src_tbl": src_tbl,
                        "dst_tbl": dst_tbl,
                        "src_cnt": src_count,
                        "dst_cnt": dst_count,
                        "disc": discrepancy,
                        "fin_src": fin_src,
                        "fin_dst": fin_dst,
                        "fin_var": fin_variance,
                        "status": status,
                        "start": t_start,
                        "end": t_end,
                        "dur": dur_ms,
                        "err": error_detail
                    })
                    
                    results.append({
                        "source_database": src_db,
                        "source_table": src_tbl,
                        "destination_table": dst_tbl,
                        "source_count": src_count,
                        "destination_count": dst_count,
                        "discrepancy": discrepancy,
                        "financial_variance": fin_variance,
                        "status": status,
                        "duration_ms": dur_ms
                    })
                except Exception as e:
                    t_end = datetime.now()
                    dur_ms = int((t_end - t_start).total_seconds() * 1000)
                    cur.execute("""
                        INSERT INTO analytics.reconciliation_logs (
                            run_batch_id, source_database, source_table, destination_table,
                            source_count, destination_count, discrepancy_count,
                            status, started_at, completed_at, duration_ms, error_details
                        ) VALUES (
                            %(batch_id)s, %(src_db)s, %(src_tbl)s, %(dst_tbl)s,
                            0, 0, 0, 'ERROR', %(start)s, %(end)s, %(dur)s, %(err)s
                        );
                    """, {
                        "batch_id": run_batch_id,
                        "src_db": src_db,
                        "src_tbl": src_tbl,
                        "dst_tbl": dst_tbl,
                        "start": t_start,
                        "end": t_end,
                        "dur": dur_ms,
                        "err": str(e)
                    })
                    results.append({
                        "source_database": src_db,
                        "source_table": src_tbl,
                        "destination_table": dst_tbl,
                        "status": "ERROR",
                        "error": str(e)
                    })
            
            conn.commit()

    total_batch_duration = (datetime.now() - start_batch_time).total_seconds()
    matched_count = sum(1 for r in results if r["status"] == "MATCH")
    
    return {
        "run_batch_id": run_batch_id,
        "mode": mode,
        "execution_date": datetime.now().isoformat(),
        "total_targets_checked": len(results),
        "targets_matched": matched_count,
        "targets_discrepancy": len(results) - matched_count,
        "total_batch_duration_seconds": round(total_batch_duration, 3),
        "target_sla_minutes": 30.0,
        "sla_met": total_batch_duration < 1800,
        "details": results
    }

def get_reconciliation_history(limit=10):
    init_reconciliation_table()
    with get_db_connection(read_only=True) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    run_batch_id,
                    COUNT(*) AS targets_checked,
                    SUM(CASE WHEN status = 'MATCH' THEN 1 ELSE 0 END) AS match_count,
                    SUM(CASE WHEN status != 'MATCH' THEN 1 ELSE 0 END) AS discrepancy_count,
                    MIN(started_at) AS run_started_at,
                    MAX(completed_at) AS run_completed_at,
                    SUM(duration_ms) AS total_duration_ms
                FROM analytics.reconciliation_logs
                GROUP BY run_batch_id
                ORDER BY MIN(started_at) DESC
                LIMIT %(limit)s;
            """, {"limit": limit})
            rows = cur.fetchall()
            
            formatted = []
            for r in rows:
                d = dict(r)
                if d.get("run_started_at"):
                    d["run_started_at"] = d["run_started_at"].isoformat()
                if d.get("run_completed_at"):
                    d["run_completed_at"] = d["run_completed_at"].isoformat()
                formatted.append(d)
            return formatted
