# -*- coding: utf-8 -*-
"""
Central Alert Management Engine.
Handles deterministic fingerprint deduplication, alert lifecycle persistence,
feedback tracking, snoozing, and notification adapter dispatch.
"""
from services.db_pool import get_db_connection
from services.alerts.adapters.admin_adapter import AdminDashboardAdapter
from services.alerts.adapters.slack_adapter import SlackNotificationAdapter
from services.alerts.adapters.email_adapter import EmailNotificationAdapter
import psycopg2.extras
import hashlib
import json
import logging
from datetime import datetime, timedelta

logger = logging.getLogger("jarvis.alerts")

class AlertManager:
    def __init__(self):
        self.admin_adapter = AdminDashboardAdapter()
        self.slack_adapter = SlackNotificationAdapter()
        self.email_adapter = EmailNotificationAdapter()

    def generate_fingerprint(self, alert_type, entity_type, entity_id, incident_ref=""):
        raw_key = f"{alert_type}:{entity_type}:{entity_id}:{incident_ref}"
        return hashlib.sha256(raw_key.encode('utf-8')).hexdigest()[:32]

    def emit_alert(self, alert_type, severity, title, summary, entity_type, entity_id, action_payload=None, metadata=None, source="RULES_ENGINE", incident_ref=""):
        """
        Emits an alert event with deterministic deduplication.
        If an open alert with the same fingerprint exists, updates last_detected_at and occurrence_count.
        """
        fingerprint = self.generate_fingerprint(alert_type, entity_type, entity_id, incident_ref)
        action_payload = action_payload or {}
        metadata = metadata or {}
        
        with get_db_connection(read_only=False) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # Check for active snooze on this alert type or entity
                cur.execute("""
                    SELECT s.snoozed_until 
                    FROM jarvis_alerts.alert_snoozes s
                    JOIN jarvis_alerts.alert_history h ON s.alert_id = h.id
                    WHERE h.fingerprint = %(fp)s AND s.snoozed_until > NOW()
                    ORDER BY s.snoozed_until DESC LIMIT 1;
                """, {"fp": fingerprint})
                snooze_row = cur.fetchone()
                if snooze_row:
                    logger.info(f"Alert [{alert_type}] for entity [{entity_id}] is currently snoozed until {snooze_row['snoozed_until']}.")
                    return {"status": "SNOOZED", "fingerprint": fingerprint}

                # Check if alert already exists
                cur.execute("""
                    SELECT id, status, occurrence_count 
                    FROM jarvis_alerts.alert_history 
                    WHERE fingerprint = %(fp)s;
                """, {"fp": fingerprint})
                existing = cur.fetchone()

                if existing:
                    # Deduplicate: update existing alert (and re-open to NEW if previously RESOLVED)
                    cur.execute("""
                        UPDATE jarvis_alerts.alert_history
                        SET occurrence_count = occurrence_count + 1,
                            last_detected_at = NOW(),
                            status = CASE WHEN status = 'RESOLVED' THEN 'NEW' ELSE status END,
                            resolved_at = CASE WHEN status = 'RESOLVED' THEN NULL ELSE resolved_at END,
                            summary = %(summary)s,
                            action_payload = %(action_payload)s,
                            metadata = %(metadata)s,
                            updated_at = NOW()
                        WHERE id = %(id)s
                        RETURNING id, fingerprint, status, occurrence_count;
                    """, {
                        "id": existing["id"],
                        "summary": summary,
                        "action_payload": json.dumps(action_payload),
                        "metadata": json.dumps(metadata)
                    })
                    updated = cur.fetchone()
                    conn.commit()
                    logger.info(f"Deduplicated alert {updated['id']} (seen {updated['occurrence_count']} times).")
                    return {"status": "DEDUPLICATED", "alert_id": str(updated["id"]), "occurrences": updated["occurrence_count"]}
                else:
                    # Insert new alert
                    cur.execute("""
                        INSERT INTO jarvis_alerts.alert_history (
                            fingerprint, alert_type, severity, title, summary,
                            entity_type, entity_id, action_payload, metadata, status
                        ) VALUES (
                            %(fp)s, %(alert_type)s, %(sev)s, %(title)s, %(summary)s,
                            %(ent_type)s, %(ent_id)s, %(act_pl)s, %(meta)s, 'NEW'
                        ) RETURNING id, fingerprint, status, created_at;
                    """, {
                        "fp": fingerprint,
                        "alert_type": alert_type,
                        "sev": severity,
                        "title": title,
                        "summary": summary,
                        "ent_type": entity_type,
                        "ent_id": entity_id,
                        "act_pl": json.dumps(action_payload),
                        "meta": json.dumps(metadata)
                    })
                    new_alert = cur.fetchone()
                    conn.commit()

                    # Construct NotificationEvent
                    event = {
                        "id": str(new_alert["id"]),
                        "fingerprint": fingerprint,
                        "alertType": alert_type,
                        "severity": severity,
                        "title": title,
                        "summary": summary,
                        "entity_type": entity_type,
                        "entity_id": entity_id,
                        "action_payload": action_payload,
                        "metadata": metadata,
                        "source": source,
                        "status": "NEW",
                        "detectedAt": new_alert["created_at"].isoformat()
                    }

                    # Dispatch to Decoupled Adapters
                    self.admin_adapter.deliver(event)
                    self.slack_adapter.deliver(event)
                    if severity in ("CRITICAL", "HIGH"):
                        self.email_adapter.deliver(event)

                    return {"status": "CREATED", "alert_id": str(new_alert["id"])}

    def get_alerts(self, status=None, severity=None, limit=50):
        with get_db_connection(read_only=True) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                clauses = []
                params = {"limit": limit}
                if status:
                    clauses.append("status = %(status)s")
                    params["status"] = status
                if severity:
                    clauses.append("severity = %(severity)s")
                    params["severity"] = severity

                where_sql = ("WHERE " + " AND ".join(clauses)) if clauses else ""
                cur.execute(f"""
                    SELECT * FROM jarvis_alerts.alert_history
                    {where_sql}
                    ORDER BY last_detected_at DESC
                    LIMIT %(limit)s;
                """, params)
                rows = cur.fetchall()
                
                formatted = []
                for r in rows:
                    d = dict(r)
                    for k in ("created_at", "updated_at", "first_detected_at", "last_detected_at", "resolved_at"):
                        if d.get(k):
                            d[k] = d[k].isoformat()
                    formatted.append(d)
                return formatted

    def acknowledge_alert(self, alert_id, user_id):
        with get_db_connection(read_only=False) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE jarvis_alerts.alert_history
                    SET status = 'ACKNOWLEDGED', updated_at = NOW()
                    WHERE id = %(id)s;
                """, {"id": alert_id})
                cur.execute("""
                    INSERT INTO jarvis_alerts.alert_feedback (alert_id, user_id, feedback_type, notes)
                    VALUES (%(id)s, %(user_id)s, 'ACKNOWLEDGE', 'Acknowledged by user');
                """, {"id": alert_id, "user_id": user_id})
                conn.commit()
                return {"status": "SUCCESS", "alert_id": alert_id}

    def resolve_alert(self, alert_id, user_id, resolution_note="", notes=""):
        note_to_use = notes or resolution_note
        with get_db_connection(read_only=False) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE jarvis_alerts.alert_history
                    SET status = 'RESOLVED', resolved_at = NOW(), updated_at = NOW()
                    WHERE id = %(id)s;
                """, {"id": alert_id})
                cur.execute("""
                    INSERT INTO jarvis_alerts.alert_feedback (alert_id, user_id, feedback_type, notes)
                    VALUES (%(id)s, %(user_id)s, 'RESOLVE', %(note)s);
                """, {"id": alert_id, "user_id": user_id, "note": note_to_use})
                conn.commit()
                return {"status": "SUCCESS", "alert_id": alert_id}

    def snooze_alert(self, alert_id, user_id, hours=4, duration_minutes=None, reason=""):
        if duration_minutes is not None:
            snooze_until = datetime.now() + timedelta(minutes=duration_minutes)
        else:
            snooze_until = datetime.now() + timedelta(hours=hours)
        with get_db_connection(read_only=False) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    UPDATE jarvis_alerts.alert_history
                    SET status = 'SNOOZED', updated_at = NOW()
                    WHERE id = %(id)s;
                """, {"id": alert_id})
                cur.execute("""
                    INSERT INTO jarvis_alerts.alert_snoozes (alert_id, snoozed_by, snoozed_until, reason)
                    VALUES (%(id)s, %(user_id)s, %(until)s, %(reason)s);
                """, {"id": alert_id, "user_id": user_id, "until": snooze_until, "reason": reason})
                conn.commit()
                return {"status": "SUCCESS", "alert_id": alert_id, "snoozed_until": snooze_until.isoformat()}

    def get_alert_by_id(self, alert_id):
        with get_db_connection(read_only=True) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT * FROM jarvis_alerts.alert_history
                    WHERE id = %(id)s;
                """, {"id": alert_id})
                row = cur.fetchone()
                if not row:
                    return None
                d = dict(row)
                for k in ("created_at", "updated_at", "first_detected_at", "last_detected_at", "resolved_at"):
                    if d.get(k):
                        d[k] = d[k].isoformat()
                return d

    def record_feedback(self, alert_id, user_id, feedback_type="NOTE", notes=""):
        with get_db_connection(read_only=False) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO jarvis_alerts.alert_feedback (alert_id, user_id, feedback_type, notes)
                    VALUES (%(id)s, %(user_id)s, %(fb_type)s, %(notes)s)
                    RETURNING id;
                """, {"id": alert_id, "user_id": user_id, "fb_type": feedback_type, "notes": notes})
                row = cur.fetchone()
                conn.commit()
                return {"status": "SUCCESS", "feedback_id": str(row[0])}

    def get_summary(self):
        with get_db_connection(read_only=True) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT 
                        COUNT(*) as total_alerts,
                        COUNT(*) FILTER (WHERE status = 'NEW') as new_count,
                        COUNT(*) FILTER (WHERE status = 'ACKNOWLEDGED') as ack_count,
                        COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_count,
                        COUNT(*) FILTER (WHERE status = 'RESOLVED') as resolved_count,
                        COUNT(*) FILTER (WHERE status = 'SNOOZED') as snoozed_count,
                        COUNT(*) FILTER (WHERE severity = 'CRITICAL' AND status IN ('NEW', 'ACKNOWLEDGED')) as critical_open,
                        COUNT(*) FILTER (WHERE severity = 'HIGH' AND status IN ('NEW', 'ACKNOWLEDGED')) as high_open,
                        COUNT(*) FILTER (WHERE severity = 'WARNING' AND status IN ('NEW', 'ACKNOWLEDGED')) as warning_open
                    FROM jarvis_alerts.alert_history;
                """)
                summary = cur.fetchone()
                return dict(summary) if summary else {}

alert_manager = AlertManager()
