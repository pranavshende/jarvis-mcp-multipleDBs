# -*- coding: utf-8 -*-
"""
Restricted Action Service REST API Endpoints.
Guarantees human-gated confirmation, role-based authorization, strict idempotency,
and immutable ledger audit tracking in jarvis_system.action_audit_ledger.
"""
from flask import Blueprint, jsonify, request
from services.actions.restricted_action_service import RestrictedActionService

actions_bp = Blueprint("actions", __name__)
action_service = RestrictedActionService()

@actions_bp.route("/api/actions/propose", methods=["POST"])
def propose_action():
    """
    Proposes an operational action (e.g. credit hold on partner 301).
    """
    data = request.get_json() or {}
    action_type = data.get("action_type", "ACTION_CREDIT_HOLD")
    partner_id = data.get("partner_id")
    requested_by = data.get("requested_by", "portal_user")
    reason = data.get("reason")

    if action_type != "ACTION_CREDIT_HOLD" or not partner_id:
        return jsonify({"success": False, "error": "Invalid action parameters. Supported: ACTION_CREDIT_HOLD with partner_id."}), 400

    try:
        proposal = action_service.propose_credit_hold(partner_id=partner_id, requested_by=requested_by, reason=reason)
        return jsonify({"success": True, "proposal": proposal})
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 404
    except Exception as ex:
        return jsonify({"success": False, "error": str(ex)}), 500

@actions_bp.route("/api/actions/pending", methods=["GET"])
def get_pending_actions():
    """
    Returns all active unexpired action proposals awaiting human confirmation.
    """
    pending = action_service.get_pending_actions()
    return jsonify({"success": True, "count": len(pending), "pending_actions": pending})

@actions_bp.route("/api/actions/<action_id>", methods=["GET"])
def get_action_details(action_id):
    """
    Returns full impact summary and confirmation requirements for a proposal.
    """
    details = action_service.get_action_details(action_id)
    if not details:
        return jsonify({"success": False, "error": "Action proposal not found or expired"}), 404
    return jsonify({"success": True, "action": details})

@actions_bp.route("/api/actions/<action_id>/confirm", methods=["POST"])
def confirm_action(action_id):
    """
    Confirms and idempotently executes an action proposal.
    Requires user_id, user_role, confirmation_token ('CONFIRM CREDIT HOLD').
    """
    data = request.get_json() or {}
    user_id = data.get("user_id", "admin_user")
    user_role = data.get("user_role", "ROLE_FOUNDER")
    confirmation_token = data.get("confirmation_token", "")
    idempotency_key = data.get("idempotency_key")

    try:
        result = action_service.confirm_and_execute(
            action_id=action_id,
            confirmed_by=user_id,
            user_role=user_role,
            confirmation_token=confirmation_token,
            idempotency_key=idempotency_key
        )
        return jsonify({"success": True, "execution": result})
    except PermissionError as pe:
        return jsonify({"success": False, "error": str(pe)}), 403
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as ex:
        return jsonify({"success": False, "error": str(ex)}), 500

@actions_bp.route("/api/actions/<action_id>/cancel", methods=["POST"])
def cancel_action(action_id):
    """
    Cancels an active action proposal.
    """
    data = request.get_json() or {}
    user_id = data.get("user_id", "operator")
    reason = data.get("reason", "Cancelled by user")

    try:
        res = action_service.cancel_action(action_id=action_id, cancelled_by=user_id, reason=reason)
        return jsonify({"success": True, "action": res})
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 404

@actions_bp.route("/api/actions/history", methods=["GET"])
def get_action_history():
    """
    Returns append-only immutable execution records from jarvis_system.action_audit_ledger.
    """
    limit = int(request.args.get("limit", 50))
    history = action_service.get_audit_history(limit=limit)
    return jsonify({"success": True, "count": len(history), "history": history})
