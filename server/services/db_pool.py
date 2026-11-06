# -*- coding: utf-8 -*-
"""
Database Connection Pool Service using psycopg2 ThreadedConnectionPool.
Enforces read-only safety, session timeouts, and connection recycling.
"""
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager
import logging
from config import DIRECT_URL, DATABASE_URL, DB_MIN_CONN, DB_MAX_CONN, STATEMENT_TIMEOUT_MS

logger = logging.getLogger("jarvis.db")

_pool = None

def get_pool():
    global _pool
    if _pool is None:
        conn_str = DIRECT_URL if DIRECT_URL else DATABASE_URL.split("?")[0]
        if not conn_str:
            raise ValueError("No database connection string configured in .env or environment")
        
        logger.info("Initializing Supabase ThreadedConnectionPool...")
        _pool = pool.ThreadedConnectionPool(
            minconn=DB_MIN_CONN,
            maxconn=DB_MAX_CONN,
            dsn=conn_str,
            sslmode="require",
            connect_timeout=10
        )
    return _pool

@contextmanager
def get_db_connection(read_only=True):
    p = get_pool()
    conn = p.getconn()
    try:
        cur = conn.cursor()
        cur.execute(f"SET statement_timeout = '{STATEMENT_TIMEOUT_MS}ms';")
        if read_only:
            cur.execute("SET default_transaction_read_only = 'on';")
        cur.close()
        yield conn
        if not read_only:
            conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        p.putconn(conn)

def check_db_health():
    try:
        with get_db_connection(read_only=True) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT version();")
                version = cur.fetchone()[0]
                cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'analytics';")
                analytics_tables = cur.fetchone()[0]
                return {
                    "status": "HEALTHY",
                    "engine": version,
                    "analytics_tables_count": analytics_tables
                }
    except Exception as e:
        return {
            "status": "UNHEALTHY",
            "error": str(e)
        }
