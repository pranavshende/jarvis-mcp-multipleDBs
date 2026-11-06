# -*- coding: utf-8 -*-
from flask import Blueprint, jsonify
from services.db_pool import check_db_health

health_bp = Blueprint("health", __name__, url_prefix="/health")

@health_bp.route("", methods=["GET"])
def health_check():
    return jsonify({
        "status": "ONLINE",
        "service": "Jarvis v1 Deterministic Intelligence Engine",
        "version": "1.0.0-PROD"
    })

@health_bp.route("/db", methods=["GET"])
def db_health_check():
    db_status = check_db_health()
    status_code = 200 if db_status.get("status") == "HEALTHY" else 503
    return jsonify(db_status), status_code
