# -*- coding: utf-8 -*-
"""
Admin Dashboard Notification Adapter.
Routes alert events directly to the database and in-memory event bus for the React UI.
"""
from services.alerts.adapters.base_adapter import BaseNotificationAdapter
import logging

logger = logging.getLogger("jarvis.admin_adapter")

class AdminDashboardAdapter(BaseNotificationAdapter):
    def __init__(self):
        super().__init__("admin_dashboard")
        self.recent_events = []

    def deliver(self, event):
        self.recent_events.insert(0, event)
        if len(self.recent_events) > 100:
            self.recent_events.pop()
        logger.info(f"[ADMIN UI ADAPTER] Delivered alert {event.get('id')} to React event bus.")
        return {
            "delivered": True,
            "channel": "REACT_DASHBOARD",
            "event_id": str(event.get("id"))
        }

    def get_recent(self):
        return self.recent_events
