# -*- coding: utf-8 -*-
"""
Restricted Action Service.
Enforces multi-step human-gated authorization, explicit token confirmation,
strict idempotency, and immutable append-only ledger auditing in jarvis_system.action_audit_ledger.

CRITICAL SECURITY PRINCIPLE:
LLM agents NEVER possess direct execution authority or write credentials.
Every operational state transition requires explicit human confirmation.
"""
import uuid
import json
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import psycopg2.extras

from services.db_pool import get_db_connection
from services.actions.downstream.portal_api_client import PortalApiClient
from services.alerts.alert_manager import AlertManager

logger = logging.getLogger("jarvis.actions.service")

AUTHORIZED_ROLES = {"ROLE_FOUNDER", "ROLE_SALES", "FOUNDER", "SALES_LEAD", "ADMIN"}
REQUIRED_CONFIRMATION_TOKEN = "CONFIRM CREDIT HOLD"

class RestrictedActionService:
    def __init__(self, portal_client=None, alert_manager=None):
        self.portal_client = portal_client or PortalApiClient()
        self.alert_manager = alert_manager or AlertManager()
        # In-memory proposal store (action_id -> proposal dict)
        # In production this can be backed by Redis; proposal lifetime is 15 minutes.
        self._proposals = {}

    def propose_credit_hold(self, partner_id, requested_by="system", reason=None):
        """
        Step 1: Proposes a credit hold on a partner.
        Fetches live financial and aging impact details from analytics.mv_partner_ar_aging.
        """
        partner_id_str = str(partner_id)
        
        with get_db_connection(read_only=True) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT 
                        partner_id, partner_name, tier, credit_limit,
                        open_invoices_count, total_open_ar, current_balance,
                        overdue_1_30d, overdue_31_60d, overdue_60d_plus,
                        credit_utilization_pct, credit_status
                    FROM analytics.mv_partner_ar_aging
                    WHERE partner_id = %(pid)s;
                """, {"pid": partner_id_str})
                partner_row = cur.fetchone()

        if not partner_row:
            raise ValueError(f"Partner ID {partner_id} not found in AR aging data.")

        p_name = partner_row["partner_name"]
        open_ar = float(partner_row["total_open_ar"])
        credit_limit = float(partner_row["credit_limit"])
        utilization = float(partner_row["credit_utilization_pct"])
        overdue_60 = float(partner_row["overdue_60d_plus"])
        open_invoices = partner_row["open_invoices_count"]

        action_id = str(uuid.uuid4())
        default_reason = f"Credit utilization at {utilization:.1f}% (${open_ar:,.2f} open AR vs ${credit_limit:,.2f} limit) with ${overdue_60:,.2f} >60d overdue."
        
        proposal = {
            "action_id": action_id,
            "action_type": "ACTION_CREDIT_HOLD",
            "target_system": "MSC_PORTAL",
            "target_entity_id": partner_id_str,
            "requested_by": requested_by,
            "status": "PROPOSED",
            "partner_info": {
                "partner_id": partner_id_str,
                "partner_name": p_name,
                "tier": partner_row["tier"],
                "credit_limit": credit_limit,
                "open_ar": open_ar,
                "credit_utilization_pct": utilization,
                "overdue_60d_plus": overdue_60,
                "open_invoices_count": open_invoices
            },
            "impact_assessment": {
                "direct_impact": f"Immediate freeze of all wholesale ordering and outbound shipping releases for {p_name}.",
                "financial_exposure": f"${open_ar:,.2f} open balance secured against further default.",
                "affected_orders": f"{open_invoices} existing open invoices under review.",
                "reversibility": "Can be reversed via Portal Admin with settlement confirmation."
            },
            "reason": reason or default_reason,
            "required_roles": list(AUTHORIZED_ROLES),
            "required_confirmation_token": REQUIRED_CONFIRMATION_TOKEN,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        }

        self._proposals[action_id] = proposal
        logger.info(f"Created action proposal {action_id} for partner {partner_id} ({p_name})")
        return proposal

    def get_pending_actions(self):
        """
        Returns all active unexpired action proposals.
        """
        now_iso = datetime.now(timezone.utc).isoformat()
        active = [p for p in self._proposals.values() if p["expires_at"] > now_iso and p["status"] == "PROPOSED"]
        return active

    def get_action_details(self, action_id):
        """
        Retrieves proposal details by action_id.
        """
        return self._proposals.get(action_id)

    def confirm_and_execute(self, action_id, confirmed_by, user_role, confirmation_token, idempotency_key=None):
        """
        Executes multi-step confirmation and dispatch:
        1. Role verification
        2. Exact confirmation token match
        3. Expiry check
        4. Idempotency ledger check
        5. Downstream dispatch
        6. Immutable append-only audit ledger write
        """
        # 1. Authorization check
        if user_role not in AUTHORIZED_ROLES:
            logger.warning(f"Unauthorized action execution attempt by user '{confirmed_by}' with role '{user_role}'.")
            raise PermissionError(f"User role '{user_role}' is not authorized. Required: {AUTHORIZED_ROLES}")

        # 2. Token match check
        if confirmation_token != REQUIRED_CONFIRMATION_TOKEN:
            logger.warning(f"Confirmation token mismatch. Expected '{REQUIRED_CONFIRMATION_TOKEN}', got '{confirmation_token}'")
            raise ValueError(f"Invalid confirmation token. You must enter exact token '{REQUIRED_CONFIRMATION_TOKEN}'.")

        # 3. Retrieve proposal
        proposal = self._proposals.get(action_id)
        if not proposal:
            raise ValueError(f"Action proposal '{action_id}' not found or already completed.")

        now_iso = datetime.now(timezone.utc).isoformat()
        if proposal["expires_at"] < now_iso:
            proposal["status"] = "EXPIRED"
            raise ValueError(f"Action proposal '{action_id}' has expired. Please propose a new action.")

        # Establish deterministic idempotency key if not supplied
        if not idempotency_key:
            idempotency_key = f"idemp_{action_id}"

        # 4. Check existing execution in action_audit_ledger
        with get_db_connection(read_only=False) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT * FROM jarvis_system.action_audit_ledger
                    WHERE idempotency_key = %(key)s;
                """, {"key": idempotency_key})
                existing_record = cur.fetchone()

                if existing_record:
                    logger.info(f"Action with idempotency key '{idempotency_key}' already executed on {existing_record['executed_at']}.")
                    proposal["status"] = "EXECUTED"
                    return {
                        "status": "ALREADY_EXECUTED",
                        "idempotency_key": idempotency_key,
                        "action_id": str(existing_record["action_id"]),
                        "executed_at": str(existing_record["executed_at"]),
                        "ledger_record": dict(existing_record)
                    }

                # 5. Dispatch to downstream Portal API client
                partner_id = proposal["target_entity_id"]
                reason = proposal["reason"]
                requested_by = proposal["requested_by"]

                portal_response = self.portal_client.apply_credit_hold(
                    partner_id=partner_id,
                    reason=reason,
                    requested_by=confirmed_by,
                    idempotency_key=idempotency_key
                )

                # 6. Immutable append-only write to action_audit_ledger
                cur.execute("""
                    INSERT INTO jarvis_system.action_audit_ledger (
                        action_id, action_type, requested_by, confirmed_by,
                        idempotency_key, status, target_system, target_entity_id,
                        payload, response, executed_at
                    ) VALUES (
                        %(act_id)s, %(act_type)s, %(req_by)s, %(conf_by)s,
                        %(idemp_key)s, 'EXECUTED', %(tgt_sys)s, %(tgt_ent)s,
                        %(payload)s, %(response)s, NOW()
                    ) RETURNING action_id, idempotency_key, status, executed_at;
                """, {
                    "act_id": action_id,
                    "act_type": proposal["action_type"],
                    "req_by": requested_by,
                    "conf_by": confirmed_by,
                    "idemp_key": idempotency_key,
                    "tgt_sys": proposal["target_system"],
                    "tgt_ent": partner_id,
                    "payload": json.dumps(proposal),
                    "response": json.dumps(portal_response)
                })
                ledger_record = cur.fetchone()
                conn.commit()

        # Update proposal state
        proposal["status"] = "EXECUTED"
        proposal["confirmed_by"] = confirmed_by
        proposal["executed_at"] = str(ledger_record["executed_at"])

        # 7. Notify systems
        p_info = proposal["partner_info"]
        logger.info(f"Successfully executed credit hold for partner {p_info['partner_id']} ({p_info['partner_name']}). Ledger UUID: {ledger_record['action_id']}")

        return {
            "status": "EXECUTED",
            "action_id": str(ledger_record["action_id"]),
            "idempotency_key": idempotency_key,
            "partner_id": partner_id,
            "partner_name": p_info["partner_name"],
            "confirmed_by": confirmed_by,
            "executed_at": str(ledger_record["executed_at"]),
            "portal_response": portal_response
        }

    def cancel_action(self, action_id, cancelled_by, reason=None):
        """
        Cancels a pending action proposal.
        """
        proposal = self._proposals.get(action_id)
        if not proposal:
            raise ValueError(f"Action proposal '{action_id}' not found.")
        
        proposal["status"] = "CANCELED"
        proposal["canceled_by"] = cancelled_by
        proposal["cancel_reason"] = reason or "Cancelled by operator."
        logger.info(f"Action proposal {action_id} was cancelled by {cancelled_by}")
        return proposal

    def get_audit_history(self, limit=50):
        """
        Reads immutable execution audit history from jarvis_system.action_audit_ledger.
        """
        with get_db_connection(read_only=True) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT 
                        action_id, action_type, requested_by, confirmed_by,
                        idempotency_key, status, target_system, target_entity_id,
                        payload, response, error_details, executed_at, created_at
                    FROM jarvis_system.action_audit_ledger
                    ORDER BY created_at DESC
                    LIMIT %(lim)s;
                """, {"lim": limit})
                rows = cur.fetchall()
        return [dict(r) for r in rows]
