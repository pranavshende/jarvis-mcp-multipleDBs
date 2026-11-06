# -*- coding: utf-8 -*-
from flask import Blueprint, request, jsonify
from services.crosswalk_service import search_product_crosswalk, get_crosswalk_stats, resolve_order

crosswalk_bp = Blueprint("crosswalk", __name__, url_prefix="/crosswalk")

@crosswalk_bp.route("/stats", methods=["GET"])
def stats():
    return jsonify({
        "status": "SUCCESS",
        "stats": get_crosswalk_stats()
    })

@crosswalk_bp.route("/products", methods=["GET"])
def search_products():
    q = request.args.get("q", "").strip()
    limit = int(request.args.get("limit", 20))
    products = search_product_crosswalk(q if q else None, limit)
    return jsonify({
        "status": "SUCCESS",
        "count": len(products),
        "products": products
    })

@crosswalk_bp.route("/order", methods=["GET"])
def order_lookup():
    order_id = request.args.get("order_id", "").strip()
    if not order_id:
        return jsonify({"status": "ERROR", "error": "Missing 'order_id' query param"}), 400
    res = resolve_order(order_id)
    return jsonify({
        "status": "SUCCESS",
        "result": res
    })
