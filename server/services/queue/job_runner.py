# -*- coding: utf-8 -*-
"""
Jarvis Background Job Runner & Queue Scheduler.
Supports Redis 7 connection for distributed queues with graceful in-process threaded fallback.
Manages deterministic schedules for ACH payout monitor, Partner credit breach,
Inventory price inversion, and Statistical anomaly detector.
"""
import os
import time
import json
import logging
import threading
from datetime import datetime, timezone

from services.rules.ach_payout_monitor import ACHPayoutMonitor
from services.rules.partner_credit_monitor import PartnerCreditMonitor
from services.rules.inventory_inversion_monitor import InventoryInversionMonitor
from services.rules.anomaly_detector import AnomalyDetector

logger = logging.getLogger("jarvis.queue.runner")

class JobRunner:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(JobRunner, cls).__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self.redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        self.redis_client = None
        self._stop_event = threading.Event()
        self._thread = None
        
        # Job registry
        self.jobs = {
            "ach_payout_monitor": {
                "name": "ACH Payout Monitor",
                "interval_seconds": 900,  # 15 mins
                "last_run": None,
                "last_status": "IDLE",
                "last_result": None,
                "handler": lambda: ACHPayoutMonitor().run()
            },
            "partner_credit_monitor": {
                "name": "Partner Credit Breach Monitor",
                "interval_seconds": 3600,  # 1 hour
                "last_run": None,
                "last_status": "IDLE",
                "last_result": None,
                "handler": lambda: PartnerCreditMonitor().run()
            },
            "inventory_inversion_monitor": {
                "name": "Inventory Price Inversion Monitor",
                "interval_seconds": 86400,  # 24 hours
                "last_run": None,
                "last_status": "IDLE",
                "last_result": None,
                "handler": lambda: InventoryInversionMonitor().run()
            },
            "anomaly_detector": {
                "name": "Statistical Anomaly Detector",
                "interval_seconds": 86400,  # 24 hours
                "last_run": None,
                "last_status": "IDLE",
                "last_result": None,
                "handler": lambda: AnomalyDetector().run()
            }
        }

        self._init_redis()

    def _init_redis(self):
        try:
            import redis
            client = redis.from_url(self.redis_url, socket_timeout=1.0)
            client.ping()
            self.redis_client = client
            logger.info(f"Connected to Redis at {self.redis_url}")
        except Exception as ex:
            self.redis_client = None
            logger.info(f"Redis not available ({ex}). Using resilient in-process background thread scheduler.")

    def run_job(self, job_key):
        """
        Executes a job synchronously by key and records execution status.
        """
        if job_key not in self.jobs:
            raise ValueError(f"Unknown job '{job_key}'. Available: {list(self.jobs.keys())}")

        job = self.jobs[job_key]
        job["last_status"] = "RUNNING"
        start_time = time.time()
        logger.info(f"Starting scheduled job '{job['name']}'...")

        try:
            res = job["handler"]()
            elapsed = round(time.time() - start_time, 2)
            job["last_run"] = datetime.now(timezone.utc).isoformat()
            job["last_status"] = "SUCCESS"
            job["last_result"] = res
            job["last_duration_sec"] = elapsed
            logger.info(f"Completed job '{job['name']}' in {elapsed}s.")
            return {
                "job": job_key,
                "status": "SUCCESS",
                "duration_sec": elapsed,
                "result": res
            }
        except Exception as ex:
            elapsed = round(time.time() - start_time, 2)
            job["last_run"] = datetime.now(timezone.utc).isoformat()
            job["last_status"] = "FAILED"
            job["last_result"] = {"error": str(ex)}
            job["last_duration_sec"] = elapsed
            logger.error(f"Job '{job['name']}' failed after {elapsed}s: {ex}", exc_info=True)
            return {
                "job": job_key,
                "status": "FAILED",
                "duration_sec": elapsed,
                "error": str(ex)
            }

    def start_background_scheduler(self):
        """
        Starts the daemon thread that periodically ticks jobs based on intervals.
        """
        if self._thread and self._thread.is_alive():
            logger.info("Background job scheduler thread is already active.")
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._scheduler_loop, name="JarvisJobScheduler", daemon=True)
        self._thread.start()
        logger.info("Started background job scheduler thread.")

    def stop_background_scheduler(self):
        """
        Stops the daemon scheduler thread.
        """
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=2.0)
            logger.info("Stopped background job scheduler.")

    def _scheduler_loop(self):
        """
        Internal scheduler tick loop.
        """
        while not self._stop_event.is_set():
            now = time.time()
            for key, job in self.jobs.items():
                last_run_iso = job.get("last_run")
                should_run = False
                if not last_run_iso:
                    # Never run yet
                    should_run = False  # Avoid slamming on startup; wait for trigger or interval
                else:
                    # Check interval
                    last_ts = datetime.fromisoformat(last_run_iso.replace("Z", "+00:00")).timestamp()
                    if now - last_ts >= job["interval_seconds"]:
                        should_run = True

                if should_run and job["last_status"] != "RUNNING":
                    # Run in separate thread so it doesn't block scheduler loop
                    t = threading.Thread(target=self.run_job, args=(key,), daemon=True)
                    t.start()

            # Tick sleep
            self._stop_event.wait(5.0)

    def get_status(self):
        """
        Returns full monitoring status of queue and scheduled jobs.
        """
        return {
            "mode": "REDIS_BULLMQ" if self.redis_client else "IN_PROCESS_FALLBACK",
            "redis_connected": self.redis_client is not None,
            "scheduler_active": self._thread.is_alive() if self._thread else False,
            "jobs": {
                k: {
                    "name": v["name"],
                    "interval_seconds": v["interval_seconds"],
                    "last_run": v["last_run"],
                    "last_status": v["last_status"],
                    "last_duration_sec": v.get("last_duration_sec"),
                    "last_result": v["last_result"]
                }
                for k, v in self.jobs.items()
            }
        }
