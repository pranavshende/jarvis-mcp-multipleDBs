# -*- coding: utf-8 -*-
from flask import Blueprint, jsonify
from services.sync_service import get_sync_status

sync_bp = Blueprint("sync", __name__, url_prefix="/sync")

@sync_bp.route("/status", methods=["GET"])
def sync_status():
    status_data = get_sync_status()
    return jsonify({
        "status": "SUCCESS",
        "sync_data": status_data
    })
