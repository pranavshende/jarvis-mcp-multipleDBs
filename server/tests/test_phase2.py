# -*- coding: utf-8 -*-
"""
Jarvis v1 — Phase 2 Automated Verification Suite.
Validates:
1. Deterministic Alert Engine & Deduplication
2. Rules Engine (ACH Payout, Partner Credit Breach, Inventory Inversion)
3. Statistical Anomaly Detector (Z-score & IQR 14-day rolling baselines)
4. Decoupled Notification Adapters (Slack HMAC, Email, Admin Event Bus)
5. Restricted Action Service (Role gating, confirmation tokens, idempotency, and audit ledger)
"""
import unittest
import uuid
import json
import sys
from pathlib import Path
from decimal import Decimal

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.alerts.alert_manager import AlertManager
from services.alerts.adapters.slack_adapter import SlackNotificationAdapter
from services.rules.ach_payout_monitor import ACHPayoutMonitor
from services.rules.partner_credit_monitor import PartnerCreditMonitor
from services.rules.inventory_inversion_monitor import InventoryInversionMonitor
from services.rules.anomaly_detector import AnomalyDetector
from services.actions.restricted_action_service import RestrictedActionService

class TestPhase2Suite(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.alert_mgr = AlertManager()
        cls.action_svc = RestrictedActionService()

    def test_01_alert_manager_deduplication(self):
        """Test deterministic fingerprinting and alert deduplication."""
        test_entity = f"TEST_ENT_{uuid.uuid4().hex[:6]}"
        
        # 1. First emission
        res1 = self.alert_mgr.emit_alert(
            alert_type="STATISTICAL_ANOMALY",
            severity="WARNING",
            title="Test Anomaly Warning",
            summary="Unit test anomaly summary",
            entity_type="TEST_METRIC",
            entity_id=test_entity,
            action_payload={"test": True},
            incident_ref="T1"
        )
        self.assertIn(res1["status"], ("CREATED", "DEDUPLICATED"))
        alert_id = res1.get("alert_id")

        # 2. Second emission with same fingerprint -> must deduplicate
        res2 = self.alert_mgr.emit_alert(
            alert_type="STATISTICAL_ANOMALY",
            severity="WARNING",
            title="Test Anomaly Warning",
            summary="Unit test anomaly summary updated",
            entity_type="TEST_METRIC",
            entity_id=test_entity,
            action_payload={"test": True},
            incident_ref="T1"
        )
        self.assertEqual(res2["status"], "DEDUPLICATED")
        self.assertEqual(res2["alert_id"], alert_id)
        self.assertGreaterEqual(res2["occurrences"], 2)

    def test_02_alert_lifecycle(self):
        """Test acknowledge, snooze, and resolve lifecycle."""
        test_entity = f"TEST_ENT_{uuid.uuid4().hex[:6]}"
        res = self.alert_mgr.emit_alert(
            alert_type="STATISTICAL_ANOMALY",
            severity="INFO" if "INFO" in ("INFO", "WARNING") else "WARNING",
            title="Lifecycle Test",
            summary="Summary",
            entity_type="TEST",
            entity_id=test_entity,
            incident_ref="LC"
        )
        alert_id = res["alert_id"]

        # Acknowledge
        ack_res = self.alert_mgr.acknowledge_alert(alert_id, user_id="TEST_USER")
        self.assertEqual(ack_res["status"], "SUCCESS")

        # Snooze
        snooze_res = self.alert_mgr.snooze_alert(alert_id, user_id="TEST_USER", hours=1)
        self.assertEqual(snooze_res["status"], "SUCCESS")

        # Resolve
        resolve_res = self.alert_mgr.resolve_alert(alert_id, user_id="TEST_USER", resolution_note="Fixed in test")
        self.assertEqual(resolve_res["status"], "SUCCESS")

    def test_03_ach_payout_monitor(self):
        """Verify ACH monitor detects the 77 blocked payouts totaling $173,339.51."""
        monitor = ACHPayoutMonitor()
        result = monitor.run()

        self.assertEqual(result["status"], "ALERT_TRIGGERED")
        self.assertEqual(result["total_count"], 77)
        self.assertAlmostEqual(result["total_amount"], 173339.51, places=2)
        self.assertEqual(result["breakdown"]["failed"]["count"], 9)
        self.assertAlmostEqual(result["breakdown"]["failed"]["amount"], 19641.44, places=2)
        self.assertEqual(result["breakdown"]["on_hold"]["count"], 68)
        self.assertAlmostEqual(result["breakdown"]["on_hold"]["amount"], 153698.07, places=2)

    def test_04_partner_credit_monitor(self):
        """Verify Partner credit monitor detects partner 301 breach (113.71% utilization)."""
        monitor = PartnerCreditMonitor()
        result = monitor.run()

        self.assertEqual(result["status"], "BREACHES_DETECTED")
        breached_ids = [r["partner_id"] for r in result["results"]]
        self.assertIn("301", breached_ids)

        p301 = next(r for r in result["results"] if r["partner_id"] == "301")
        self.assertAlmostEqual(p301["utilization"], 113.71, places=1)

    def test_05_inventory_inversion_monitor(self):
        """Verify Inventory Inversion Monitor evaluates 5,374 market records."""
        monitor = InventoryInversionMonitor()
        result = monitor.run()

        self.assertEqual(result["status"], "HEALTHY")
        self.assertEqual(result["market_price_records_checked"], 5374)
        self.assertEqual(result["inverted_count"], 0)

    def test_06_statistical_anomaly_math(self):
        """Verify statistical calculations (Mean, StdDev, Z-Score, IQR)."""
        detector = AnomalyDetector()
        values = [10.0, 12.0, 11.0, 13.0, 10.0, 11.0, 12.0, 11.0, 12.0, 10.0, 11.0, 12.0, 10.0, 11.0]
        stats = detector._calculate_stats(values)

        self.assertEqual(stats["n"], 14)
        self.assertAlmostEqual(stats["mean"], 11.1429, places=2)
        self.assertGreater(stats["std_dev"], 0.8)
        self.assertAlmostEqual(stats["median"], 11.0, places=1)
        self.assertLess(stats["lower_fence"], stats["q1"])
        self.assertGreater(stats["upper_fence"], stats["q3"])

    def test_07_slack_adapter_hmac_signature(self):
        """Verify Slack HMAC-SHA256 signature verification."""
        import time
        adapter = SlackNotificationAdapter(signing_secret="test_signing_secret_12345")
        timestamp = str(int(time.time()))
        body = '{"text": "hello"}'

        sig = adapter.compute_signature(timestamp, body)
        self.assertTrue(sig.startswith("v0="))
        self.assertTrue(adapter.verify_slack_signature(timestamp, sig, body))

        # Verification must fail with tampered body
        self.assertFalse(adapter.verify_slack_signature(timestamp, sig, '{"text": "tampered"}'))

    def test_08_restricted_action_lifecycle_and_security(self):
        """Verify human confirmation gating, token enforcement, role verification, and idempotency."""
        # 1. Proposal creation
        proposal = self.action_svc.propose_credit_hold(301, requested_by="audit_test")
        self.assertEqual(proposal["status"], "PROPOSED")
        self.assertEqual(proposal["partner_info"]["partner_id"], "301")
        self.assertAlmostEqual(proposal["partner_info"]["credit_utilization_pct"], 113.71, places=1)
        action_id = proposal["action_id"]

        # 2. Reject unauthorized role
        with self.assertRaises(PermissionError):
            self.action_svc.confirm_and_execute(
                action_id=action_id,
                confirmed_by="unauth_user",
                user_role="ROLE_WAREHOUSE",
                confirmation_token="CONFIRM CREDIT HOLD"
            )

        # 3. Reject invalid token
        with self.assertRaises(ValueError):
            self.action_svc.confirm_and_execute(
                action_id=action_id,
                confirmed_by="founder_user",
                user_role="ROLE_FOUNDER",
                confirmation_token="APPROVE"
            )

        # 4. Valid execution
        idemp_key = f"idemp_unit_test_{uuid.uuid4().hex[:8]}"
        res = self.action_svc.confirm_and_execute(
            action_id=action_id,
            confirmed_by="founder_user",
            user_role="ROLE_FOUNDER",
            confirmation_token="CONFIRM CREDIT HOLD",
            idempotency_key=idemp_key
        )
        self.assertEqual(res["status"], "EXECUTED")
        self.assertEqual(res["idempotency_key"], idemp_key)

        # 5. Idempotent rerun returns ALREADY_EXECUTED without error
        res_repeat = self.action_svc.confirm_and_execute(
            action_id=action_id,
            confirmed_by="founder_user",
            user_role="ROLE_FOUNDER",
            confirmation_token="CONFIRM CREDIT HOLD",
            idempotency_key=idemp_key
        )
        self.assertEqual(res_repeat["status"], "ALREADY_EXECUTED")

if __name__ == "__main__":
    unittest.main()
