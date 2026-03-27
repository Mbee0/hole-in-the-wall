from datetime import datetime, timezone

from bson import ObjectId
from flask import Blueprint, jsonify, request

from services.auth_helpers import serialize_deal
from services.authz import account_type_required
from services.db import deals_collection, users_collection

bp = Blueprint("customer", __name__, url_prefix="/api/customer")


def _require_dict(payload, field_name: str):
    if payload is None:
        return False
    return isinstance(payload, dict)


@bp.get("/preferences")
@account_type_required("consumer")
def get_preferences(user):
    return jsonify({"preferences": user.get("preferences", {})}), 200


@bp.put("/preferences")
@account_type_required("consumer")
def put_preferences(user):
    payload = request.get_json(force=True)
    if not _require_dict(payload, "preferences"):
        return jsonify({"error": "preferences must be an object"}), 400

    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"preferences": payload}},
    )

    updated = users_collection.find_one({"_id": user["_id"]})
    return jsonify({"preferences": updated.get("preferences", {})}), 200


@bp.get("/activity")
@account_type_required("consumer")
def get_activity(user):
    log = user.get("activity_log", []) or []
    return jsonify({"activity": log[-50:]}), 200


@bp.post("/log")
@account_type_required("consumer")
def post_log(user):
    payload = request.get_json(force=True) or {}
    action = (payload.get("action") or "").strip()
    entity_type = (payload.get("entity_type") or "").strip()
    entity_id = (payload.get("entity_id") or "").strip()
    metadata = payload.get("metadata") or {}

    if not action:
        return jsonify({"error": "action is required"}), 400
    if entity_type and not isinstance(entity_type, str):
        return jsonify({"error": "entity_type must be a string"}), 400

    entry = {
        "action": action,
        "entity_type": entity_type or None,
        "entity_id": entity_id or None,
        "metadata": metadata if isinstance(metadata, dict) else {},
        "ts": datetime.now(timezone.utc).isoformat(),
    }

    users_collection.update_one(
        {"_id": user["_id"]},
        # Keep a rolling activity history (avoid unbounded growth).
        {"$push": {"activity_log": {"$each": [entry], "$slice": -200}}},
    )

    # Return last 50 without another query: best-effort response.
    updated = users_collection.find_one({"_id": user["_id"]})
    log = updated.get("activity_log", []) or []
    return jsonify({"activity": log[-50:]}), 200


@bp.get("/saved-deals")
@account_type_required("consumer")
def get_saved_deals(user):
    saved = user.get("saved_deals", []) or []
    # stored as strings; keep only valid ObjectIds
    object_ids = []
    for deal_id in saved:
        try:
            object_ids.append(ObjectId(deal_id))
        except Exception:
            pass

    if not object_ids:
        return jsonify({"saved_deals": []}), 200

    deals = list(deals_collection.find({"_id": {"$in": object_ids}}))
    return jsonify({"saved_deals": [serialize_deal(d) for d in deals]}), 200


@bp.post("/save-deal")
@account_type_required("consumer")
def save_deal(user):
    payload = request.get_json(force=True) or {}
    deal_id = (payload.get("deal_id") or "").strip()
    if not deal_id:
        return jsonify({"error": "deal_id is required"}), 400

    try:
        obj_id = ObjectId(deal_id)
    except Exception:
        return jsonify({"error": "Invalid deal_id"}), 400

    if not deals_collection.find_one({"_id": obj_id}):
        return jsonify({"error": "Deal not found"}), 404

    users_collection.update_one(
        {"_id": user["_id"]},
        {"$addToSet": {"saved_deals": deal_id}},
    )

    return jsonify({"message": "Deal saved"}), 201

