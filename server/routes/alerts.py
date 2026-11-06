# -*- coding: utf-8 -*-
"""
Alert Management REST API Endpoints.
Provides alert feed querying, filtering, lifecycle updates, snoozing, and feedback tracking.
"""
from flask import Blueprint, jsonify, request
from services.alerts.alert_manager import AlertManager

alerts_bp = Blueprint("alerts", __name__)
alert_manager = AlertManager()

@alerts_bp.route("/api/alerts", methods=["GET"])
def get_alerts():
    """
    Retrieves alert history filtered by status, severity, and limit.
    """
    status = request.args.get("status")
    severity = request.args.get("severity")
    limit = int(request.args.get("limit", 50))

    alerts = alert_manager.get_alerts(status=status, severity=severity, limit=limit)
    return jsonify({
        "success": True,
        "count": len(alerts),
        "alerts": alerts
    })

@alerts_bp.route("/api/alerts/<alert_id>", methods=["GET"])
def get_alert_by_id(alert_id):
    """
    Retrieves details for a single alert.
    """
    alert = alert_manager.get_alert_by_id(alert_id)
    if not alert:
        return jsonify({"success": False, "error": "Alert not found"}), 404
    return jsonify({"success": True, "alert": alert})

@alerts_bp.route("/api/alerts/<alert_id>/acknowledge", methods=["POST"])
def acknowledge_alert(alert_id):
    """
    Transitions alert to ACKNOWLEDGED state.
    """
    data = request.get_json() or {}
    user_id = data.get("user_id", "anonymous_user")
    
    res = alert_manager.acknowledge_alert(alert_id, user_id=user_id)
    if res.get("status") == "NOT_FOUND":
        return jsonify({"success": False, "error": "Alert not found"}), 404
    return jsonify({"success": True, "result": res})

@alerts_bp.route("/api/alerts/<alert_id>/resolve", methods=["POST"])
def resolve_alert(alert_id):
    """
    Transitions alert to RESOLVED state.
    """
    data = request.get_json() or {}
    user_id = data.get("user_id", "anonymous_user")
    notes = data.get("notes", "")

    res = alert_manager.resolve_alert(alert_id, user_id=user_id, notes=notes)
    if res.get("status") == "NOT_FOUND":
        return jsonify({"success": False, "error": "Alert not found"}), 404
    return jsonify({"success": True, "result": res})

@alerts_bp.route("/api/alerts/<alert_id>/snooze", methods=["POST"])
def snooze_alert(alert_id):
    """
    Snoozes an alert for a specified duration in minutes.
    """
    data = request.get_json() or {}
    user_id = data.get("user_id", "anonymous_user")
    duration_minutes = int(data.get("duration_minutes", 60))
    reason = data.get("reason", "Operator snoozed alert.")

    res = alert_manager.snooze_alert(alert_id, user_id=user_id, duration_minutes=duration_minutes, reason=reason)
    if res.get("status") == "NOT_FOUND":
        return jsonify({"success": False, "error": "Alert not found"}), 404
    return jsonify({"success": True, "result": res})

@alerts_bp.route("/api/alerts/<alert_id>/feedback", methods=["POST"])
def record_feedback(alert_id):
    """
    Records operator feedback (e.g. FALSE_POSITIVE, NOTE).
    """
    data = request.get_json() or {}
    user_id = data.get("user_id", "anonymous_user")
    feedback_type = data.get("feedback_type", "NOTE")
    notes = data.get("notes", "")

    res = alert_manager.record_feedback(alert_id, user_id=user_id, feedback_type=feedback_type, notes=notes)
    return jsonify({"success": True, "feedback_id": res.get("feedback_id")})

@alerts_bp.route("/api/alerts/summary", methods=["GET"])
def get_alerts_summary():
    """
    Returns high-level alert counts by severity and status.
    """
    summary = alert_manager.get_summary()
    return jsonify({"success": True, "summary": summary})
