# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify
from services.metrics_engine import execute_metric, list_registered_metrics

metrics_bp = Blueprint("metrics", __name__, url_prefix="/metrics")

@metrics_bp.route("/list", methods=["GET"])
def list_metrics():
    return jsonify({
        "status": "SUCCESS",
        "registered_metrics": list_registered_metrics()
    })

@metrics_bp.route("/execute", methods=["POST"])
def run_metric():
    body = request.get_json(force=True, silent=True) or {}
    metric_id = body.get("metric_id")
    if not metric_id:
        return jsonify({
            "status": "ERROR",
            "error": "Missing required field 'metric_id'"
        }), 400
        
    params = body.get("parameters", {})
    try:
        result = execute_metric(metric_id, params)
        return jsonify({
            "status": "SUCCESS",
            "result": result
        })
    except ValueError as e:
        return jsonify({
            "status": "ERROR",
            "error": str(e)
        }), 404
    except Exception as e:
        return jsonify({
            "status": "ERROR",
            "error": f"Execution error: {str(e)}"
        }), 500
