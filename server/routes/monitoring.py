# -*- coding: utf-8 -*-
"""
Monitoring & Anomaly Detection REST API Endpoints.
Provides background runner health, job execution triggers, and statistical anomaly insights.
"""
from flask import Blueprint, jsonify, request
from services.queue.job_runner import JobRunner
from services.rules.anomaly_detector import AnomalyDetector

monitoring_bp = Blueprint("monitoring", __name__)
job_runner = JobRunner()
anomaly_detector = AnomalyDetector()

@monitoring_bp.route("/api/monitoring/status", methods=["GET"])
def get_monitoring_status():
    """
    Returns runner status, redis connection state, and last execution metrics.
    """
    status = job_runner.get_status()
    return jsonify({"success": True, "status": status})

@monitoring_bp.route("/api/monitoring/jobs", methods=["GET"])
def list_jobs():
    """
    Lists all configured background jobs and intervals.
    """
    jobs = [
        {"key": k, "name": v["name"], "interval_seconds": v["interval_seconds"]}
        for k, v in job_runner.jobs.items()
    ]
    return jsonify({"success": True, "jobs": jobs})

@monitoring_bp.route("/api/monitoring/run", methods=["POST"])
def trigger_job():
    """
    Synchronously triggers an operational rule or monitor.
    """
    data = request.get_json() or {}
    job_key = data.get("job")
    if not job_key:
        return jsonify({"success": False, "error": "Missing 'job' parameter"}), 400

    try:
        res = job_runner.run_job(job_key)
        return jsonify({"success": True, "result": res})
    except ValueError as ve:
        return jsonify({"success": False, "error": str(ve)}), 400
    except Exception as ex:
        return jsonify({"success": False, "error": str(ex)}), 500

@monitoring_bp.route("/api/monitoring/anomalies", methods=["GET"])
def get_anomalies():
    """
    Computes and returns rolling 14-day statistical baselines and anomaly status.
    """
    try:
        result = anomaly_detector.run()
        return jsonify({"success": True, "anomalies": result})
    except Exception as ex:
        return jsonify({"success": False, "error": str(ex)}), 500
