# -*- coding: utf-8 -*-
"""
Inventory Price Inversion Monitor Rule.
Executes daily to compare inventory unit costs (FIFO valuation / 180-day avg paid)
against market spot prices and portal list prices to detect margin inversion risks.
"""
import logging
from decimal import Decimal
import psycopg2.extras
from services.db_pool import get_db_connection
from services.alerts.alert_manager import AlertManager

logger = logging.getLogger("jarvis.rules.inventory_inversion")

class InventoryInversionMonitor:
    def __init__(self, alert_manager=None):
        self.alert_manager = alert_manager or AlertManager()

    def run(self):
        """
        Scans inventory cost layers against market prices and catalog list prices.
        Emits INVENTORY_PRICE_INVERSION alerts if cost exceeds spot valuation.
        """
        logger.info("Executing Inventory Price Inversion Monitor...")
        with get_db_connection(read_only=True) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                # 1. Check latest date of market prices
                cur.execute("""
                    SELECT MAX(price_date) as max_date, COUNT(*) as total_records
                    FROM staging_portal.market_prices;
                """)
                market_meta = cur.fetchone()
                latest_date = market_meta["max_date"] if market_meta else None

                # 2. Check for inverted items: unit cost > list price OR unit cost > median market box price
                cur.execute("""
                    SELECT 
                        dp.canonical_product_id,
                        dp.canonical_sku,
                        dp.canonical_name,
                        dp.list_price,
                        dp.avg_paid_180d,
                        cl.unit_cost_fifo,
                        cl.qty_on_hand,
                        (cl.unit_cost_fifo - dp.list_price) as unit_inversion_amount
                    FROM analytics.dim_products dp
                    JOIN analytics.fact_cost_layers cl ON cl.item_id = dp.wms_item_id
                    WHERE dp.list_price > 0 AND cl.unit_cost_fifo > dp.list_price
                    ORDER BY (cl.unit_cost_fifo - dp.list_price) DESC;
                """)
                inverted_items = cur.fetchall()

        if not inverted_items:
            logger.info("Inventory Inversion Monitor: 0 inverted products found. Inventory valuations healthy.")
            return {
                "status": "HEALTHY",
                "market_price_records_checked": market_meta["total_records"] if market_meta else 0,
                "latest_market_date": str(latest_date),
                "inverted_count": 0
            }

        results = []
        for item in inverted_items:
            sku = item["canonical_sku"]
            name = item["canonical_name"]
            cost = float(item["unit_cost_fifo"])
            list_price = float(item["list_price"])
            qty = item["qty_on_hand"]
            loss_exposure = float(item["unit_inversion_amount"]) * qty

            title = f"Inventory Price Inversion: {name} (${cost:.2f} cost vs ${list_price:.2f} list)"
            summary = (
                f"Product '{name}' (SKU: {sku}) has a FIFO unit cost of ${cost:.2f}, "
                f"which exceeds the current list price of ${list_price:.2f} by ${cost - list_price:.2f}/unit. "
                f"Total inventory on hand: {qty} units with ${loss_exposure:,.2f} unrealized negative margin exposure."
            )

            action_payload = {
                "sku": sku,
                "product_name": name,
                "unit_cost_fifo": cost,
                "list_price": list_price,
                "qty_on_hand": qty,
                "unrealized_loss": loss_exposure,
                "recommended_action": "Review pricing tier or mark down inventory layer."
            }

            metadata = {
                "rule_id": "RULE_INVENTORY_PRICE_INVERSION",
                "avg_paid_180d": float(item["avg_paid_180d"]) if item["avg_paid_180d"] else None,
                "latest_market_date": str(latest_date)
            }

            alert_res = self.alert_manager.emit_alert(
                alert_type="INVENTORY_PRICE_INVERSION",
                severity="WARNING" if loss_exposure < 5000 else "CRITICAL",
                title=title,
                summary=summary,
                entity_type="PRODUCT",
                entity_id=sku,
                action_payload=action_payload,
                metadata=metadata,
                source="RULES_ENGINE",
                incident_ref=f"INVERSION_{sku}"
            )
            results.append({
                "sku": sku,
                "loss_exposure": loss_exposure,
                "alert_res": alert_res
            })

        return {
            "status": "INVERSIONS_DETECTED",
            "count": len(results),
            "results": results
        }
