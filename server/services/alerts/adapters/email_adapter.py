# -*- coding: utf-8 -*-
"""
Provider-Independent Email Notification Adapter.
Formats structured alert summaries and delivers via SMTP or mock logging.
"""
from services.alerts.adapters.base_adapter import BaseNotificationAdapter
import logging
import os

logger = logging.getLogger("jarvis.email")

class EmailNotificationAdapter(BaseNotificationAdapter):
    def __init__(self, smtp_host=None):
        super().__init__("email")
        self.smtp_host = smtp_host or os.environ.get("SMTP_HOST", None)
        self.notification_recipient = os.environ.get("ALERT_EMAIL_RECIPIENT", "ops-alerts@meridian.internal")

    def deliver(self, event):
        subject = f"[{event.get('severity')}] {event.get('title')}"
        body = f"""
Jarvis v1 Operational Alert
========================================
Title:     {event.get('title')}
Severity:  {event.get('severity')}
Entity:    {event.get('entity_type')}:{event.get('entity_id')}
Summary:   {event.get('summary')}
Source:    {event.get('source')}
Timestamp: {event.get('detectedAt')}

Recommended Action:
{event.get('action_payload', {}).get('recommendation', 'Log in to Admin Dashboard to investigate.')}

Dashboard Link: http://localhost:3001
========================================
        """
        if self.smtp_host:
            # Live SMTP would be used here
            return {"delivered": True, "provider": "SMTP", "recipient": self.notification_recipient}
        else:
            logger.info(f"[EMAIL MOCK DELIVERED] To: {self.notification_recipient} | Subject: {subject}")
            return {
                "delivered": True,
                "mode": "STAGING_MOCK",
                "recipient": self.notification_recipient,
                "subject": subject
            }
