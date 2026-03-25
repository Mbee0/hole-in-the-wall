from flask import Blueprint, jsonify, request
from bson import ObjectId
from services.db import db

bp = Blueprint("businesses", __name__, url_prefix="/api/businesses")

def serialize_business(doc):
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name"),
        "category": doc.get("category"),
        "address": doc.get("address"),
        "story": doc.get("story", ""),
        "claimed": doc.get("claimed", False),
        "deal_summary": doc.get("deal_summary", ""),
        "lat": doc.get("lat"),
        "lng": doc.get("lng"),
    }

@bp.get("")
def get_businesses():
    category = request.args.get("category")
    query = {"category": category} if category else {}
    docs = db.businesses.find(query)
    return jsonify([serialize_business(doc) for doc in docs]), 200

@bp.get("/<business_id>")
def get_business(business_id):
    try:
        doc = db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        doc = None

    if not doc:
        return jsonify({"error": "Business not found."}), 404

    return jsonify(serialize_business(doc)), 200

@bp.post("")
def create_business():
    payload = request.get_json(force=True)
    name = payload.get("name", "").strip()
    if not name:
        return jsonify({"error": "Business name is required."}), 400

    new_doc = {
        "name": name,
        "category": payload.get("category", "Restaurant"),
        "address": payload.get("address", ""),
        "story": payload.get("story", ""),
        "claimed": bool(payload.get("claimed", False)),
        "deal_summary": payload.get("deal_summary", ""),
        "lat": payload.get("lat"),
        "lng": payload.get("lng"),
    }
    result = db.businesses.insert_one(new_doc)
    new_doc["_id"] = result.inserted_id

    return jsonify(serialize_business(new_doc)), 201
