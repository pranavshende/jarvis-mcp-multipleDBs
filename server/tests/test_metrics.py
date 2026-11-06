# -*- coding: utf-8 -*-
import unittest
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app import create_app

class TestMetrics(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_list_metrics(self):
        res = self.client.get("/api/metrics/list")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(len(data["registered_metrics"]), 15)

    def test_daily_packages_metric(self):
        res = self.client.post("/api/metrics/execute", json={
            "metric_id": "DAILY_PACKAGES_RECEIVED",
            "parameters": {"date": "2026-10-19"}
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "SUCCESS")
        self.assertTrue(len(data["result"]["data"]) > 0)

    def test_blocked_payouts_metric(self):
        res = self.client.post("/api/metrics/execute", json={
            "metric_id": "PAYOUT_STATUS_SUMMARY"
        })
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "SUCCESS")
        reasons = [r["failure_reason"] for r in data["result"]["data"]]
        self.assertTrue(any("R01" in str(r) for r in reasons))

    def test_invalid_metric_rejection(self):
        res = self.client.post("/api/metrics/execute", json={
            "metric_id": "NON_EXISTENT_METRIC"
        })
        self.assertEqual(res.status_code, 404)

if __name__ == "__main__":
    unittest.main()
