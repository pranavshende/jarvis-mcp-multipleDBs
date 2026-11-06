# -*- coding: utf-8 -*-
"""
Jarvis v1 — Backend Server Application Entrypoint (Flask REST API)
Provides deterministic analytical RPC endpoints, crosswalk lookups, sync status,
nightly reconciliation, alert management, background monitoring, and restricted action dispatch.
"""
from flask import Flask, jsonify
from flask_cors import CORS
from config import PORT, HOST, DEBUG
from routes.health import health_bp
from routes.metrics import metrics_bp
from routes.crosswalk import crosswalk_bp
from routes.sync import sync_bp
from routes.reconciliation import reconciliation_bp
from routes.alerts import alerts_bp
from routes.monitoring import monitoring_bp
from routes.actions import actions_bp
from services.queue.job_runner import JobRunner

def create_app():
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    
    # Enable CORS for React frontend (localhost:3001, etc.)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Register Phase 1 Blueprints
    app.register_blueprint(health_bp, url_prefix="/api/health")
    app.register_blueprint(metrics_bp, url_prefix="/api/metrics")
    app.register_blueprint(crosswalk_bp, url_prefix="/api/crosswalk")
    app.register_blueprint(sync_bp, url_prefix="/api/sync")
    app.register_blueprint(reconciliation_bp, url_prefix="/api/reconciliation")
    
    # Register Phase 2 Blueprints
    app.register_blueprint(alerts_bp)
    app.register_blueprint(monitoring_bp)
    app.register_blueprint(actions_bp)
    
    @app.route("/")
    def index():
        return jsonify({
            "service": "Jarvis v1 Enterprise Intelligence Server (Phase 1 & Phase 2 Active)",
            "endpoints": {
                "health": "/api/health/db",
                "metrics": "/api/metrics/list",
                "reconciliation": "/api/reconciliation/history",
                "alerts": "/api/alerts",
                "monitoring": "/api/monitoring/status",
                "actions": "/api/actions/pending"
            }
        })
        
    return app

if __name__ == "__main__":
    app = create_app()
    # Start background job scheduler
    runner = JobRunner()
    runner.start_background_scheduler()
    print(f"Starting Jarvis v1 Flask Server on http://{HOST}:{PORT}")
    app.run(host=HOST, port=PORT, debug=DEBUG)
