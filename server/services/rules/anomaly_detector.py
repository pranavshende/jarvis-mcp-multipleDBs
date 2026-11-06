# -*- coding: utf-8 -*-
"""
Statistical Anomaly Detection Engine.
Computes rolling 14-day parametric (Z-score) and non-parametric (IQR) statistics
for Daily Inspection Failure Rates and Daily Dock Scan Volumes.
Emits WARNING (|Z| >= 2.0) and CRITICAL (|Z| >= 3.0) operational alerts.
"""
import math
import logging
from datetime import datetime, date
import psycopg2.extras
from services.db_pool import get_db_connection
from services.alerts.alert_manager import AlertManager

logger = logging.getLogger("jarvis.rules.anomaly_detector")

class AnomalyDetector:
    def __init__(self, alert_manager=None, window_days=14):
        self.alert_manager = alert_manager or AlertManager()
        self.window_days = window_days

    @staticmethod
    def _calculate_stats(values):
        """
        Calculates Mean, Sample StdDev, Median, Q1, Q3, IQR, and Outlier Fences.
        """
        n = len(values)
        if n == 0:
            return None
        
        # Mean
        mean = sum(values) / n
        
        # Sample StdDev
        if n > 1:
            variance = sum((x - mean) ** 2 for x in values) / (n - 1)
            std_dev = math.sqrt(variance)
        else:
            std_dev = 0.0

        # Percentiles
        sorted_vals = sorted(values)
        def percentile(p):
            k = (n - 1) * p
            f = math.floor(k)
            c = math.ceil(k)
            if f == c:
                return sorted_vals[int(k)]
            d0 = sorted_vals[int(f)] * (c - k)
            d1 = sorted_vals[int(c)] * (k - f)
            return d0 + d1

        median = percentile(0.50)
        q1 = percentile(0.25)
        q3 = percentile(0.75)
        iqr = q3 - q1
        lower_fence = q1 - 1.5 * iqr
        upper_fence = q3 + 1.5 * iqr

        return {
            "n": n,
            "mean": round(mean, 4),
            "std_dev": round(std_dev, 4),
            "median": round(median, 4),
            "q1": round(q1, 4),
            "q3": round(q3, 4),
            "iqr": round(iqr, 4),
            "lower_fence": round(lower_fence, 4),
            "upper_fence": round(upper_fence, 4)
        }

    def detect_inspection_anomalies(self):
        """
        Evaluates daily inspection failure rates over the rolling 14-day window.
        """
        with get_db_connection(read_only=True) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT 
                        DATE(inspected_at) as day,
                        SUM(qty_received) as total_received,
                        SUM(qty_failed) as total_failed,
                        ROUND((SUM(qty_failed)::numeric / NULLIF(SUM(qty_received), 0)::numeric) * 100, 2) as fail_rate_pct
                    FROM analytics.fact_inspections
                    WHERE inspected_at IS NOT NULL
                    GROUP BY DATE(inspected_at)
                    ORDER BY day DESC
                    LIMIT %(limit)s;
                """, {"limit": self.window_days + 1})
                rows = cur.fetchall()

        if not rows:
            return {"status": "NO_DATA", "metric": "INSPECTION_FAILURE_RATE"}

        # rows are ordered DESC; latest is index 0
        latest_row = rows[0]
        historical_rows = rows[1:] if len(rows) > 1 else rows
        
        rates = [float(r["fail_rate_pct"] or 0.0) for r in historical_rows]
        stats = self._calculate_stats(rates)
        
        latest_val = float(latest_row["fail_rate_pct"] or 0.0)
        z_score = 0.0
        if stats and stats["std_dev"] > 0:
            z_score = round((latest_val - stats["mean"]) / stats["std_dev"], 2)

        is_iqr_outlier = bool(stats and (latest_val < stats["lower_fence"] or latest_val > stats["upper_fence"]))
        
        status = "NORMAL"
        severity = None
        if abs(z_score) >= 3.0:
            status = "CRITICAL_ANOMALY"
            severity = "CRITICAL"
        elif abs(z_score) >= 2.0 or is_iqr_outlier:
            status = "WARNING_ANOMALY"
            severity = "WARNING"

        alert_res = None
        if severity:
            direction = "Spike" if z_score > 0 else "Drop"
            title = f"Inspection Failure Rate {direction}: {latest_val:.1f}% (Z={z_score:+.2f})"
            summary = (
                f"Daily inspection failure rate on {latest_row['day']} was {latest_val:.1f}% "
                f"({latest_row['total_failed']} failed out of {latest_row['total_received']} items received). "
                f"Rolling 14-day baseline: mean {stats['mean']:.1f}% ± {stats['std_dev']:.1f}%. "
                f"Z-Score is {z_score:+.2f} ({'outside IQR fence' if is_iqr_outlier else 'standard deviation breach'})."
            )

            action_payload = {
                "metric": "INSPECTION_FAILURE_RATE",
                "evaluated_date": str(latest_row["day"]),
                "current_value": latest_val,
                "z_score": z_score,
                "is_iqr_outlier": is_iqr_outlier,
                "stats": stats,
                "total_received": latest_row["total_received"],
                "total_failed": latest_row["total_failed"],
                "recommended_action": "Audit warehouse inbound line inspection reports and packaging vendor lot."
            }

            alert_res = self.alert_manager.emit_alert(
                alert_type="STATISTICAL_ANOMALY",
                severity=severity,
                title=title,
                summary=summary,
                entity_type="METRIC",
                entity_id=f"INSPECTION_FAILURE_RATE_{latest_row['day']}",
                action_payload=action_payload,
                metadata={"metric_type": "INSPECTION_FAILURES", "window_days": self.window_days},
                source="ANOMALY_DETECTOR",
                incident_ref=f"INSPECT_{latest_row['day']}"
            )

        return {
            "metric": "INSPECTION_FAILURE_RATE",
            "status": status,
            "evaluated_date": str(latest_row["day"]),
            "latest_value": latest_val,
            "z_score": z_score,
            "is_iqr_outlier": is_iqr_outlier,
            "stats": stats,
            "alert_result": alert_res
        }

    def detect_dock_scan_anomalies(self):
        """
        Evaluates daily inbound dock scan volumes over the rolling 14-day window.
        """
        with get_db_connection(read_only=True) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT 
                        DATE(received_at) as day,
                        COUNT(*) as scan_count
                    FROM analytics.fact_dock_receipts
                    WHERE received_at IS NOT NULL
                    GROUP BY DATE(received_at)
                    ORDER BY day DESC
                    LIMIT %(limit)s;
                """, {"limit": self.window_days + 1})
                rows = cur.fetchall()

        if not rows:
            return {"status": "NO_DATA", "metric": "DOCK_SCAN_VOLUME"}

        latest_row = rows[0]
        historical_rows = rows[1:] if len(rows) > 1 else rows

        scans = [float(r["scan_count"]) for r in historical_rows]
        stats = self._calculate_stats(scans)

        latest_val = float(latest_row["scan_count"])
        z_score = 0.0
        if stats and stats["std_dev"] > 0:
            z_score = round((latest_val - stats["mean"]) / stats["std_dev"], 2)

        is_iqr_outlier = bool(stats and (latest_val < stats["lower_fence"] or latest_val > stats["upper_fence"]))

        status = "NORMAL"
        severity = None
        if abs(z_score) >= 3.0:
            status = "CRITICAL_ANOMALY"
            severity = "CRITICAL"
        elif abs(z_score) >= 2.0 or is_iqr_outlier:
            status = "WARNING_ANOMALY"
            severity = "WARNING"

        alert_res = None
        if severity:
            direction = "Surge" if z_score > 0 else "Drop"
            title = f"Dock Scan Volume {direction}: {int(latest_val)} scans (Z={z_score:+.2f})"
            summary = (
                f"Daily dock scan volume on {latest_row['day']} was {int(latest_val)} inbound receipts. "
                f"Rolling 14-day baseline: mean {stats['mean']:.1f} ± {stats['std_dev']:.1f} scans. "
                f"Z-Score is {z_score:+.2f} ({'outside IQR bounds' if is_iqr_outlier else 'standard deviation excursion'})."
            )

            action_payload = {
                "metric": "DOCK_SCAN_VOLUME",
                "evaluated_date": str(latest_row["day"]),
                "current_value": latest_val,
                "z_score": z_score,
                "is_iqr_outlier": is_iqr_outlier,
                "stats": stats,
                "recommended_action": "Check warehouse receiving dock staffing and carrier delivery logs."
            }

            alert_res = self.alert_manager.emit_alert(
                alert_type="STATISTICAL_ANOMALY",
                severity=severity,
                title=title,
                summary=summary,
                entity_type="METRIC",
                entity_id=f"DOCK_SCAN_VOLUME_{latest_row['day']}",
                action_payload=action_payload,
                metadata={"metric_type": "DOCK_SCAN_VOLUME", "window_days": self.window_days},
                source="ANOMALY_DETECTOR",
                incident_ref=f"DOCK_{latest_row['day']}"
            )

        return {
            "metric": "DOCK_SCAN_VOLUME",
            "status": status,
            "evaluated_date": str(latest_row["day"]),
            "latest_value": latest_val,
            "z_score": z_score,
            "is_iqr_outlier": is_iqr_outlier,
            "stats": stats,
            "alert_result": alert_res
        }

    def run(self):
        """
        Executes both anomaly detection routines and aggregates output.
        """
        logger.info("Executing Statistical Anomaly Detection Engine...")
        insp_res = self.detect_inspection_anomalies()
        dock_res = self.detect_dock_scan_anomalies()
        return {
            "status": "COMPLETED",
            "inspection_anomalies": insp_res,
            "dock_anomalies": dock_res
        }
