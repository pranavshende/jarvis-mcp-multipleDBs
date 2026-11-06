# -*- coding: utf-8 -*-
import unittest
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from app import create_app

class TestHealth(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.client = self.app.test_client()

    def test_health_endpoint(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "ONLINE")
        self.assertEqual(data["version"], "1.0.0-PROD")

    def test_db_health(self):
        res = self.client.get("/api/health/db")
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data["status"], "HEALTHY")
        self.assertIn("PostgreSQL", data["engine"])

if __name__ == "__main__":
    unittest.main()
