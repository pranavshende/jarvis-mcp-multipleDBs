# -*- coding: utf-8 -*-
"""
Slack Notification Adapter.
Formats alerts into Slack Block Kit and verifies interactive HMAC signatures.
"""
from services.alerts.adapters.base_adapter import BaseNotificationAdapter
import hmac
import hashlib
import time
import json
import logging
import os

logger = logging.getLogger("jarvis.slack")

class SlackNotificationAdapter(BaseNotificationAdapter):
    def __init__(self, signing_secret=None, webhook_url=None):
        super().__init__("slack")
        self.signing_secret = signing_secret or os.environ.get("SLACK_SIGNING_SECRET", "mock_signing_secret_meridian_2026")
        self.webhook_url = webhook_url or os.environ.get("SLACK_WEBHOOK_URL", None)

    def format_block_kit(self, event):
        severity = event.get("severity", "INFO")
        severity_color = {
            "CRITICAL": "#ef4444",
            "HIGH": "#f97316",
            "WARNING": "#f59e0b",
            "INFO": "#3b82f6"
        }.get(severity, "#6b7280")

        emoji = {
            "CRITICAL": "🚨",
            "HIGH": "⚠️",
            "WARNING": "⚡",
            "INFO": "ℹ️"
        }.get(severity, "📢")

        blocks = [
            {
                "type": "header",
                "text": {
                    "type": "plain_text",
                    "text": f"{emoji} [{severity}] {event.get('title', 'Jarvis Alert')}"
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Summary:* {event.get('summary')}\n*Entity:* `{event.get('entity_type')}:{event.get('entity_id')}`\n*Source:* `{event.get('source')}`"
                }
            }
        ]

        # Add Recommended Action if present
        if event.get("action_payload"):
            action = event["action_payload"]
            blocks.append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"💡 *Recommended Action:* {action.get('recommendation', 'Review incident details.')}"
                }
            })

        # Add Interactive Action Buttons
        blocks.append({
            "type": "actions",
            "elements": [
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Acknowledge"},
                    "value": str(event.get("id")),
                    "action_id": "action_acknowledge_alert"
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Resolve"},
                    "style": "primary",
                    "value": str(event.get("id")),
                    "action_id": "action_resolve_alert"
                },
                {
                    "type": "button",
                    "text": {"type": "plain_text", "text": "Snooze (4h)"},
                    "value": str(event.get("id")),
                    "action_id": "action_snooze_alert_4h"
                }
            ]
        })

        return {
            "attachments": [
                {
                    "color": severity_color,
                    "blocks": blocks
                }
            ]
        }

    def compute_signature(self, timestamp, request_body):
        """
        Computes the Slack v0 HMAC-SHA256 signature for a given timestamp and body.
        """
        sig_basestring = f"v0:{timestamp}:{request_body}".encode('utf-8')
        return 'v0=' + hmac.new(
            self.signing_secret.encode('utf-8'),
            sig_basestring,
            hashlib.sha256
        ).hexdigest()

    def verify_slack_signature(self, timestamp, signature, request_body):
        """
        Verifies Slack request signature using HMAC-SHA256 to prevent replay attacks.
        """
        if not timestamp or not signature:
            return False
        
        # Check for replay attack: reject requests older than 5 minutes
        if abs(time.time() - int(timestamp)) > 60 * 5:
            logger.warning("Slack signature verification failed: timestamp expired (>5 min).")
            return False

        sig_basestring = f"v0:{timestamp}:{request_body}".encode('utf-8')
        my_signature = 'v0=' + hmac.new(
            self.signing_secret.encode('utf-8'),
            sig_basestring,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(my_signature, signature)

    def deliver(self, event):
        payload = self.format_block_kit(event)
        if self.webhook_url:
            # Live delivery
            import requests
            try:
                res = requests.post(self.webhook_url, json=payload, timeout=5)
                return {"delivered": res.status_code == 200, "status_code": res.status_code}
            except Exception as e:
                logger.error(f"Live Slack delivery failed: {e}")
                return {"delivered": False, "error": str(e)}
        else:
            # Mock / Staging delivery mode
            logger.info(f"[SLACK MOCK DELIVERED] Event {event.get('id')}: {event.get('title')}")
            return {
                "delivered": True,
                "mode": "STAGING_MOCK",
                "channel": "#meridian-ops-alerts",
                "formatted_payload": payload
            }
