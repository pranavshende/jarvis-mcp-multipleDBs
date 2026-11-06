# -*- coding: utf-8 -*-
"""
Partner Credit Breach Monitor Rule.
Executes hourly to scan partner AR aging, detect credit limit breaches and severe overdue accounts,
and generate deterministic critical operational alerts with restricted action proposals.
"""
import logging
from decimal import Decimal
import psycopg2.extras
from services.db_pool import get_db_connection
from services.alerts.alert_manager import AlertManager

logger = logging.getLogger("jarvis.rules.partner_credit")

class PartnerCreditMonitor:
    def __init__(self, alert_manager=None):
        self.alert_manager = alert_manager or AlertManager()

    def run(self):
        """
        Scans analytics.mv_partner_ar_aging for partners exceeding credit limit
        or having severe overdue balances (>60 days).
        Emits PARTNER_CREDIT_BREACH alerts with proposed credit hold actions.
        """
        logger.info("Executing Partner Credit Breach Monitor...")
        with get_db_connection(read_only=True) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT 
                        partner_id,
                        partner_name,
                        tier,
                        credit_limit,
                        open_invoices_count,
                        total_open_ar,
                        current_balance,
                        overdue_1_30d,
                        overdue_31_60d,
                        overdue_60d_plus,
                        credit_utilization_pct,
                        credit_status
                    FROM analytics.mv_partner_ar_aging
                    WHERE credit_utilization_pct > 100 OR credit_status = 'BREACHED'
                    ORDER BY total_open_ar DESC;
                """)
                breached_partners = cur.fetchall()

        if not breached_partners:
            logger.info("Partner Credit Monitor: 0 breached partners found.")
            return {"status": "HEALTHY", "breached_count": 0}

        results = []
        for partner in breached_partners:
            p_id = str(partner["partner_id"])
            p_name = partner["partner_name"]
            limit = float(partner["credit_limit"])
            open_ar = float(partner["total_open_ar"])
            utilization = float(partner["credit_utilization_pct"])
            overdue_60 = float(partner["overdue_60d_plus"])

            title = f"Partner Credit Limit Breach: {p_name} ({utilization:.1f}% Utilization)"
            summary = (
                f"Partner '{p_name}' (ID: {p_id}) has exceeded their ${limit:,.2f} credit limit with "
                f"${open_ar:,.2f} in total open AR ({utilization:.1f}% utilization). "
                f"Severely overdue balance (>60 days): ${overdue_60:,.2f} across {partner['open_invoices_count']} invoices. "
                f"Immediate credit hold recommendation generated."
            )

            action_payload = {
                "action_type": "ACTION_CREDIT_HOLD",
                "partner_id": int(p_id) if p_id.isdigit() else p_id,
                "partner_name": p_name,
                "credit_limit": limit,
                "open_ar": open_ar,
                "credit_utilization_pct": utilization,
                "overdue_60d_plus": overdue_60,
                "open_invoices_count": partner["open_invoices_count"],
                "impact": "Freezes wholesale ordering and shipment releases until balance is rectified.",
                "requires_approval_by": ["FOUNDER", "SALES_LEAD"]
            }

            metadata = {
                "rule_id": "RULE_PARTNER_CREDIT_BREACH",
                "tier": partner["tier"],
                "current_balance": float(partner["current_balance"]),
                "overdue_1_30d": float(partner["overdue_1_30d"]),
                "overdue_31_60d": float(partner["overdue_31_60d"]),
                "overdue_60d_plus": overdue_60
            }

            alert_res = self.alert_manager.emit_alert(
                alert_type="PARTNER_CREDIT_BREACH",
                severity="CRITICAL",
                title=title,
                summary=summary,
                entity_type="PARTNER",
                entity_id=p_id,
                action_payload=action_payload,
                metadata=metadata,
                source="RULES_ENGINE",
                incident_ref=f"CREDIT_{p_id}"
            )
            results.append({
                "partner_id": p_id,
                "partner_name": p_name,
                "utilization": utilization,
                "alert_res": alert_res
            })

        return {
            "status": "BREACHES_DETECTED",
            "count": len(results),
            "results": results
        }
