# -*- coding: utf-8 -*-
"""
Jarvis v1 — Backend Server Application Entrypoint (Flask REST API)
Provides deterministic analytical RPC endpoints, crosswalk lookups, and sync status.
"""
from flask import Flask, jsonify
from flask_cors import CORS
from config import PORT, HOST, DEBUG
from routes.health import health_bp
from routes.metrics import metrics_bp
from routes.crosswalk import crosswalk_bp
from routes.sync import sync_bp

def create_app():
    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    
    # Enable CORS for React frontend (localhost:5173, localhost:3000, etc.)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    
    # Register Route Blueprints under /api
    app.register_blueprint(health_bp, url_prefix="/api/health")
    app.register_blueprint(metrics_bp, url_prefix="/api/metrics")
    app.register_blueprint(crosswalk_bp, url_prefix="/api/crosswalk")
    app.register_blueprint(sync_bp, url_prefix="/api/sync")
    
    @app.route("/")
    def index():
        return jsonify({
            "service": "Jarvis v1 Backend Intelligence Server",
            "documentation": "/api/metrics/list",
            "health": "/api/health/db"
        })
        
    return app

if __name__ == "__main__":
    app = create_app()
    print(f"Starting Jarvis v1 Flask Server on http://{HOST}:{PORT}")
    app.run(host=HOST, port=PORT, debug=DEBUG)
