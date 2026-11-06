# -*- coding: utf-8 -*-
from flask import Blueprint, jsonify, request
from services.reconciliation.reconciliation_engine import run_reconciliation, get_reconciliation_history

reconciliation_bp = Blueprint("reconciliation", __name__, url_prefix="/reconciliation")

@reconciliation_bp.route("/run", methods=["POST"])
def trigger_reconciliation():
    body = request.get_json(force=True, silent=True) or {}
    mode = body.get("mode", "MANUAL_SNAPSHOT")
    result = run_reconciliation(mode=mode)
    return jsonify({
        "status": "SUCCESS",
        "result": result
    })

@reconciliation_bp.route("/history", methods=["GET"])
def history():
    limit = int(request.args.get("limit", 10))
    hist = get_reconciliation_history(limit=limit)
    return jsonify({
        "status": "SUCCESS",
        "history": hist
    })
