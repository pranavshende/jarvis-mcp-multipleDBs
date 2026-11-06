# -*- coding: utf-8 -*-
"""
Server Configuration Module for Jarvis v1 Flask Backend.
"""
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(BASE_DIR, ".env")

def load_env():
    env_vars = {}
    if os.path.exists(ENV_PATH):
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip().strip('"').strip("'")
    return env_vars

_env = load_env()

DATABASE_URL = os.environ.get("DATABASE_URL", _env.get("DATABASE_URL", ""))
DIRECT_URL = os.environ.get("DIRECT_URL", _env.get("DIRECT_URL", ""))
PORT = int(os.environ.get("PORT", 5000))
HOST = os.environ.get("HOST", "0.0.0.0")
DEBUG = os.environ.get("DEBUG", "False").lower() in ("true", "1", "yes")

# Database Pooling Configuration
DB_MIN_CONN = int(os.environ.get("DB_MIN_CONN", 2))
DB_MAX_CONN = int(os.environ.get("DB_MAX_CONN", 10))
STATEMENT_TIMEOUT_MS = int(os.environ.get("STATEMENT_TIMEOUT_MS", 8000))
