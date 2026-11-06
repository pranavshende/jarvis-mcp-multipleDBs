# -*- coding: utf-8 -*-
"""
Decoupled Notification Adapter Interface.
All notification delivery providers implement this abstract interface.
"""
from abc import ABC, abstractmethod

class BaseNotificationAdapter(ABC):
    def __init__(self, name="base"):
        self.name = name

    @abstractmethod
    def deliver(self, event):
        """
        Deliver a standardized NotificationEvent.
        Returns: dict with delivery status and metadata
        """
        pass
