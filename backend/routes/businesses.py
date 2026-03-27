from flask import Blueprint, jsonify, request
from bson import ObjectId
from services.db import db
from services.authz import account_type_required

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
        "offer_types": doc.get("offer_types", []),  # deals/catering/fundraising
        "deal_focus": doc.get("deal_focus", []),  # meals/drinks/dessert
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
@account_type_required("business")
def create_business(user):
    payload = request.get_json(force=True)
    name = payload.get("name", "").strip()
    if not name:
        return jsonify({"error": "Business name is required."}), 400

    offer_types = payload.get("offer_types", []) or []
    deal_focus = payload.get("deal_focus", []) or []
    if not isinstance(offer_types, list):
        return jsonify({"error": "offer_types must be a list."}), 400
    if not isinstance(deal_focus, list):
        return jsonify({"error": "deal_focus must be a list."}), 400

    # Keep known values only.
    allowed_offer_types = {"deals", "catering", "fundraising"}
    allowed_deal_focus = {"meals", "drinks", "dessert"}
    offer_types = [x for x in offer_types if isinstance(x, str) and x in allowed_offer_types]
    deal_focus = [x for x in deal_focus if isinstance(x, str) and x in allowed_deal_focus]

    new_doc = {
        "name": name,
        "category": payload.get("category", "Restaurant"),
        "address": payload.get("address", ""),
        "story": payload.get("story", ""),
        "claimed": bool(payload.get("claimed", False)),
        "deal_summary": payload.get("deal_summary", ""),
        "lat": payload.get("lat"),
        "lng": payload.get("lng"),
        "owner_user_id": str(user["_id"]),
        "offer_types": offer_types,
        "deal_focus": deal_focus,
    }
    result = db.businesses.insert_one(new_doc)
    new_doc["_id"] = result.inserted_id

    return jsonify(serialize_business(new_doc)), 201
