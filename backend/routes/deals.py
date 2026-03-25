from flask import Blueprint, jsonify, request
from services.db import db

bp = Blueprint("deals", __name__, url_prefix="/api/deals")

@bp.get("")
def get_deals():
    deals = list(db.deals.find({}, {"_id": 0}))
    return jsonify(deals), 200

@bp.post("")
def create_deal():
    payload = request.get_json(force=True)
    title = payload.get("title", "").strip()
    business_name = payload.get("business_name", "").strip()

    if not title or not business_name:
        return jsonify({"error": "Deal title and business name are required."}), 400

    deal = {
        "title": title,
        "business_name": business_name,
        "description": payload.get("description", ""),
        "type": payload.get("type", "Student Deal"),
        "expires": payload.get("expires", ""),
        "student_only": bool(payload.get("student_only", False)),
    }
    db.deals.insert_one(deal)
    return jsonify(deal), 201
