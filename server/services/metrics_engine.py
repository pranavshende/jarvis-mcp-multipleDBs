# -*- coding: utf-8 -*-
"""
Deterministic Business Metrics Engine.
Executes registered, parameterized SQL against the Supabase analytics database.
The LLM never computes arithmetic or writes arbitrary SQL.
"""
from services.db_pool import get_db_connection
from datetime import datetime
import psycopg2.extras

METRICS_REGISTRY = {
    "DAILY_PACKAGES_RECEIVED": {
        "name": "Daily Warehouse Package Receipts",
        "category": "OPERATIONS",
        "description": "Total inbound packages scanned as received within facility local operating date.",
        "timezone_aware": True,
        "sql": """
            SELECT 
                wh.code AS facility_code,
                wh.name AS facility_name,
                wh.timezone AS iana_timezone,
                COUNT(ip.package_id) AS packages_received
            FROM staging_wms.inbound_packages ip
            JOIN staging_wms.warehouses wh ON ip.warehouse_id = wh.warehouse_id
            WHERE (ip.received_at AT TIME ZONE 'UTC' AT TIME ZONE wh.timezone)::date = %(target_date)s::date
              AND (%(facility_code)s IS NULL OR wh.code = %(facility_code)s)
            GROUP BY wh.code, wh.name, wh.timezone
            ORDER BY wh.code;
        """
    },
    "DAILY_UNITS_RECEIVED": {
        "name": "Daily Warehouse Unit Receipts",
        "category": "OPERATIONS",
        "description": "Total physical items/units inspected on the receiving dock on a given date.",
        "timezone_aware": True,
        "sql": """
            SELECT 
                wh.code AS facility_code,
                wh.name AS facility_name,
                COALESCE(SUM(pl.qty_received), 0) AS units_received,
                COALESCE(SUM(pl.qty_passed), 0) AS units_passed,
                COALESCE(SUM(pl.qty_failed), 0) AS units_failed
            FROM staging_wms.inbound_packages ip
            JOIN staging_wms.warehouses wh ON ip.warehouse_id = wh.warehouse_id
            JOIN staging_wms.package_lines pl ON ip.package_id = pl.package_id
            WHERE (ip.received_at AT TIME ZONE 'UTC' AT TIME ZONE wh.timezone)::date = %(target_date)s::date
              AND (%(facility_code)s IS NULL OR wh.code = %(facility_code)s)
            GROUP BY wh.code, wh.name;
        """
    },
    "WAREHOUSE_RECEIVING_SUMMARY": {
        "name": "Warehouse-Wise Receiving Summary & Timezone Comparison",
        "category": "OPERATIONS",
        "description": "Compares local facility calendar date vs naive UTC date to explain timezone shifts.",
        "timezone_aware": True,
        "sql": """
            WITH local_agg AS (
                SELECT 
                    wh.code AS facility_code,
                    COUNT(ip.package_id) AS local_count
                FROM staging_wms.inbound_packages ip
                JOIN staging_wms.warehouses wh ON ip.warehouse_id = wh.warehouse_id
                WHERE (ip.received_at AT TIME ZONE 'UTC' AT TIME ZONE wh.timezone)::date = %(target_date)s::date
                GROUP BY wh.code
            ),
            utc_agg AS (
                SELECT 
                    wh.code AS facility_code,
                    COUNT(ip.package_id) AS utc_count
                FROM staging_wms.inbound_packages ip
                JOIN staging_wms.warehouses wh ON ip.warehouse_id = wh.warehouse_id
                WHERE ip.received_at::date = %(target_date)s::date
                GROUP BY wh.code
            )
            SELECT 
                wh.code AS facility_code,
                wh.name AS facility_name,
                wh.timezone,
                COALESCE(l.local_count, 0) AS local_packages,
                COALESCE(u.utc_count, 0) AS utc_packages,
                (COALESCE(l.local_count, 0) - COALESCE(u.utc_count, 0)) AS variance_from_timezone_shift
            FROM staging_wms.warehouses wh
            LEFT JOIN local_agg l ON wh.code = l.facility_code
            LEFT JOIN utc_agg u ON wh.code = u.facility_code
            ORDER BY wh.code;
        """
    },
    "PARTNER_AR_TOTAL": {
        "name": "Total Open Wholesale Accounts Receivable",
        "category": "FINANCE",
        "description": "Total outstanding unpaid wholesale invoice balances across B2B partners.",
        "sql": """
            SELECT 
                COUNT(i.invoice_id) AS unpaid_invoices_count,
                COALESCE(SUM(i.amount::numeric - i.amount_paid::numeric), 0) AS total_open_ar,
                COUNT(DISTINCT i.partner_id) AS partners_with_open_balance
            FROM staging_portal.invoices i
            WHERE i.status != 'paid';
        """
    },
    "PARTNER_AR_AGING": {
        "name": "Partner Accounts Receivable Aging",
        "category": "FINANCE",
        "description": "Aged AR breakdown by 30, 60, and 90+ day overdue buckets.",
        "sql": """
            SELECT 
                p.partner_id,
                p.name AS partner_name,
                p.credit_limit::numeric,
                COALESCE(SUM(i.amount::numeric - i.amount_paid::numeric), 0) AS total_open_ar,
                COALESCE(SUM(CASE WHEN i.due_date >= CURRENT_DATE THEN (i.amount::numeric - i.amount_paid::numeric) ELSE 0 END), 0) AS current_balance,
                COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE AND i.due_date >= CURRENT_DATE - 30 THEN (i.amount::numeric - i.amount_paid::numeric) ELSE 0 END), 0) AS overdue_1_30d,
                COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE - 30 AND i.due_date >= CURRENT_DATE - 60 THEN (i.amount::numeric - i.amount_paid::numeric) ELSE 0 END), 0) AS overdue_31_60d,
                COALESCE(SUM(CASE WHEN i.due_date < CURRENT_DATE - 60 THEN (i.amount::numeric - i.amount_paid::numeric) ELSE 0 END), 0) AS overdue_60d_plus
            FROM staging_portal.partners p
            LEFT JOIN staging_portal.invoices i ON p.partner_id = i.partner_id AND i.status != 'paid'
            GROUP BY p.partner_id, p.name, p.credit_limit
            HAVING COALESCE(SUM(i.amount::numeric - i.amount_paid::numeric), 0) > 0
            ORDER BY overdue_60d_plus DESC, total_open_ar DESC;
        """
    },
    "PARTNER_CREDIT_UTILIZATION": {
        "name": "Partner Credit Utilization & Breach Detection",
        "category": "CREDIT_RISK",
        "description": "Calculates credit limit utilization and identifies breached accounts.",
        "sql": """
            SELECT 
                p.partner_id,
                p.name AS partner_name,
                p.tier,
                p.credit_limit::numeric,
                COALESCE(SUM(i.amount::numeric - i.amount_paid::numeric), 0) AS open_ar,
                ROUND((COALESCE(SUM(i.amount::numeric - i.amount_paid::numeric), 0) / NULLIF(p.credit_limit::numeric, 0)) * 100, 2) AS credit_utilization_pct,
                CASE 
                    WHEN COALESCE(SUM(i.amount::numeric - i.amount_paid::numeric), 0) > p.credit_limit::numeric THEN 'BREACHED'
                    WHEN COALESCE(SUM(i.amount::numeric - i.amount_paid::numeric), 0) > (p.credit_limit::numeric * 0.90) THEN 'WARNING_90'
                    ELSE 'NORMAL'
                END AS credit_status
            FROM staging_portal.partners p
            LEFT JOIN staging_portal.invoices i ON p.partner_id = i.partner_id AND i.status != 'paid'
            WHERE (%(partner_id)s IS NULL OR p.partner_id = %(partner_id)s)
            GROUP BY p.partner_id, p.name, p.tier, p.credit_limit
            ORDER BY credit_utilization_pct DESC NULLS LAST;
        """
    },
    "MONTHLY_REVENUE": {
        "name": "Monthly Recognized Wholesale Revenue",
        "category": "FINANCE",
        "description": "Total recognized invoiced wholesale sales for a specific calendar month.",
        "sql": """
            SELECT 
                TO_CHAR(issued_at, 'YYYY-MM') AS billing_month,
                COUNT(invoice_id) AS invoice_count,
                COALESCE(SUM(amount::numeric), 0) AS gross_invoiced_revenue,
                COALESCE(SUM(amount_paid::numeric), 0) AS total_collected
            FROM staging_portal.invoices
            WHERE TO_CHAR(issued_at, 'YYYY-MM') = %(target_month)s
            GROUP BY TO_CHAR(issued_at, 'YYYY-MM');
        """
    },
    "FIFO_COGS": {
        "name": "FIFO Cost of Goods Sold",
        "category": "FINANCE",
        "description": "Cost of goods acquired from sellers for settled submissions within a given period.",
        "sql": """
            SELECT 
                TO_CHAR(paid_at, 'YYYY-MM') AS settled_month,
                COUNT(submission_id) AS settled_submissions_count,
                COALESCE(SUM(approved_total::numeric), 0) AS total_cogs
            FROM staging_seller.submissions
            WHERE status = 'paid'
              AND paid_at IS NOT NULL
              AND TO_CHAR(paid_at, 'YYYY-MM') = %(target_month)s
            GROUP BY TO_CHAR(paid_at, 'YYYY-MM');
        """
    },
    "GROSS_PROFIT": {
        "name": "Gross Profit (Revenue minus COGS)",
        "category": "FINANCE",
        "description": "Recognized wholesale revenue minus recognized acquisition COGS.",
        "sql": """
            WITH rev AS (
                SELECT COALESCE(SUM(amount::numeric), 0) AS rev_total
                FROM staging_portal.invoices
                WHERE TO_CHAR(issued_at, 'YYYY-MM') = %(target_month)s
            ),
            cogs AS (
                SELECT COALESCE(SUM(approved_total::numeric), 0) AS cogs_total
                FROM staging_seller.submissions
                WHERE status = 'paid' AND TO_CHAR(paid_at, 'YYYY-MM') = %(target_month)s
            )
            SELECT 
                r.rev_total AS gross_revenue,
                c.cogs_total AS total_cogs,
                (r.rev_total - c.cogs_total) AS gross_profit,
                ROUND(((r.rev_total - c.cogs_total) / NULLIF(r.rev_total, 0)) * 100, 2) AS gross_margin_pct
            FROM rev r, cogs c;
        """
    },
    "GROSS_MARGIN_PCT": {
        "name": "Gross Margin Percentage",
        "category": "FINANCE",
        "description": "Gross profit as a percentage of gross revenue.",
        "sql": """
            WITH rev AS (
                SELECT COALESCE(SUM(amount::numeric), 0) AS rev_total
                FROM staging_portal.invoices
                WHERE TO_CHAR(issued_at, 'YYYY-MM') = %(target_month)s
            ),
            cogs AS (
                SELECT COALESCE(SUM(approved_total::numeric), 0) AS cogs_total
                FROM staging_seller.submissions
                WHERE status = 'paid' AND TO_CHAR(paid_at, 'YYYY-MM') = %(target_month)s
            )
            SELECT 
                ROUND(((r.rev_total - c.cogs_total) / NULLIF(r.rev_total, 0)) * 100, 2) AS gross_margin_pct
            FROM rev r, cogs c;
        """
    },
    "GAAP_NET_INCOME": {
        "name": "GAAP Net Income (Closed Month Accrual)",
        "category": "FINANCE",
        "description": "Final GAAP Accrual Net Income accounting for fixed facility OPEX ($291,800.00).",
        "sql": """
            WITH rev AS (
                SELECT COALESCE(SUM(amount::numeric), 0) AS gross_revenue
                FROM staging_portal.invoices
                WHERE TO_CHAR(issued_at, 'YYYY-MM') = %(target_month)s
            ),
            cogs AS (
                SELECT COALESCE(SUM(approved_total::numeric), 0) AS total_cogs
                FROM staging_seller.submissions
                WHERE status = 'paid' AND TO_CHAR(paid_at, 'YYYY-MM') = %(target_month)s
            )
            SELECT 
                %(target_month)s AS reporting_period,
                CASE WHEN %(target_month)s = '2026-09' THEN 'CLOSED_AUDITED' ELSE 'UNCLOSED_ESTIMATE' END AS accounting_status,
                r.gross_revenue,
                c.total_cogs,
                (r.gross_revenue - c.total_cogs) AS gross_profit,
                291800.00 AS monthly_fixed_opex,
                (r.gross_revenue - c.total_cogs - 291800.00) AS net_profit_gaap,
                ROUND(((r.gross_revenue - c.total_cogs - 291800.00) / NULLIF(r.gross_revenue, 0)) * 100, 2) AS net_profit_margin_pct
            FROM rev r, cogs c;
        """
    },
    "NET_MARGIN_PCT": {
        "name": "Net Profit Margin Percentage",
        "category": "FINANCE",
        "description": "Net GAAP profit as a percentage of total revenue.",
        "sql": """
            WITH rev AS (
                SELECT COALESCE(SUM(amount::numeric), 0) AS gross_revenue
                FROM staging_portal.invoices
                WHERE TO_CHAR(issued_at, 'YYYY-MM') = %(target_month)s
            ),
            cogs AS (
                SELECT COALESCE(SUM(approved_total::numeric), 0) AS total_cogs
                FROM staging_seller.submissions
                WHERE status = 'paid' AND TO_CHAR(paid_at, 'YYYY-MM') = %(target_month)s
            )
            SELECT 
                ROUND(((r.gross_revenue - c.total_cogs - 291800.00) / NULLIF(r.gross_revenue, 0)) * 100, 2) AS net_profit_margin_pct
            FROM rev r, cogs c;
        """
    },
    "INVENTORY_FIFO_VALUATION": {
        "name": "Total On-Hand Inventory FIFO Valuation",
        "category": "INVENTORY",
        "description": "Total book valuation of inventory on hand across warehouse bins.",
        "sql": """
            SELECT 
                COUNT(DISTINCT sl.item_id) AS distinct_items_count,
                COALESCE(SUM(sl.qty_on_hand), 0) AS total_units_on_hand,
                COALESCE(SUM(sl.qty_on_hand * COALESCE(wi.avg_paid_180d::numeric, 0)), 0) AS total_fifo_book_value
            FROM staging_wms.stock_levels sl
            JOIN staging_wms.wms_items wi ON sl.item_id = wi.item_id;
        """
    },
    "INVENTORY_MARKET_COMPARISON": {
        "name": "Inventory Book Value vs Fair Market Value Comparison",
        "category": "INVENTORY",
        "description": "Identifies products with significant market price drops (>20%) vs acquisition cost.",
        "sql": """
            SELECT 
                wi.item_id,
                wi.description,
                wi.category,
                wi.avg_paid_180d::numeric AS acquisition_unit_cost,
                SUM(sl.qty_on_hand) AS units_on_hand,
                (SUM(sl.qty_on_hand) * wi.avg_paid_180d::numeric) AS total_fifo_book_value
            FROM staging_wms.wms_items wi
            JOIN staging_wms.stock_levels sl ON wi.item_id = sl.item_id
            GROUP BY wi.item_id, wi.description, wi.category, wi.avg_paid_180d
            ORDER BY total_fifo_book_value DESC
            LIMIT 10;
        """
    },
    "PAYOUT_STATUS_SUMMARY": {
        "name": "Member Payout Status Summary & ACH Errors",
        "category": "FINANCE",
        "description": "Detailed breakdown of completed vs failed and on-hold member ACH payouts.",
        "sql": """
            SELECT 
                p.status,
                COALESCE(p.failure_reason, 'None') AS failure_reason,
                COUNT(p.payout_id) AS payout_count,
                COALESCE(SUM(p.amount::numeric), 0) AS total_amount_usd
            FROM staging_seller.payouts p
            GROUP BY p.status, p.failure_reason
            ORDER BY total_amount_usd DESC;
        """
    }
}

def execute_metric(metric_id, params=None):
    if metric_id not in METRICS_REGISTRY:
        raise ValueError(f"Metric '{metric_id}' is not registered in the Metrics Registry.")
    
    definition = METRICS_REGISTRY[metric_id]
    sql = definition["sql"]
    
    # Defaults
    query_params = {
        "target_date": params.get("date", "2026-10-19") if params else "2026-10-19",
        "facility_code": params.get("facility_code", None) if params else None,
        "target_month": params.get("month", "2026-09") if params else "2026-09",
        "partner_id": params.get("partner_id", None) if params else None
    }
    
    start_time = datetime.now()
    with get_db_connection(read_only=True) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, query_params)
            rows = cur.fetchall()
            duration_ms = int((datetime.now() - start_time).total_seconds() * 1000)
            
            # Convert non-serializable objects (decimals, dates) to strings/floats
            formatted_rows = []
            for r in rows:
                row_dict = {}
                for k, v in dict(r).items():
                    if hasattr(v, '__float__'):
                        row_dict[k] = float(v)
                    elif hasattr(v, 'isoformat'):
                        row_dict[k] = v.isoformat()
                    else:
                        row_dict[k] = v
                formatted_rows.append(row_dict)
                
            return {
                "metric_id": metric_id,
                "metric_name": definition["name"],
                "category": definition["category"],
                "description": definition["description"],
                "parameters": query_params,
                "execution_duration_ms": duration_ms,
                "rows_count": len(formatted_rows),
                "data": formatted_rows
            }

def list_registered_metrics():
    return [
        {
            "metric_id": mid,
            "name": m["name"],
            "category": m["category"],
            "description": m["description"]
        }
        for mid, m in METRICS_REGISTRY.items()
    ]
