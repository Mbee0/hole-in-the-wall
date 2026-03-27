from flask import Blueprint, jsonify, request
from bson import ObjectId

from services.db import db
from services.auth_helpers import serialize_deal
from services.authz import account_type_required

bp = Blueprint("deals", __name__, url_prefix="/api/deals")

@bp.get("")
def get_deals():
    docs = list(db.deals.find({}))
    return jsonify([serialize_deal(doc) for doc in docs]), 200

@bp.post("")
@account_type_required("business")
def create_deal(user):
    payload = request.get_json(force=True)
    title = payload.get("title", "").strip()
    business_name = payload.get("business_name", "").strip()

    if not title or not business_name:
        return jsonify({"error": "Deal title and business name are required."}), 400

    deal = {
        "title": title,
        "business_name": business_name,
        "description": payload.get("description", ""),
        # Keep backend payload fields flexible for older frontend/code.
        "deal_type": payload.get("deal_type", payload.get("type", "Student Deal")),
        "expires": payload.get("expires", ""),
        "student_only": bool(payload.get("student_only", False)),
        "created_by_user_id": str(user["_id"]),
    }
    result = db.deals.insert_one(deal)
    deal["_id"] = result.inserted_id
    return jsonify(serialize_deal(deal)), 201
