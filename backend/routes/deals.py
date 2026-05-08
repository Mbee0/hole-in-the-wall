from flask import Blueprint, jsonify, request
from bson import ObjectId

from services.db import db
from services.auth_helpers import serialize_deal
from services.authz import account_type_required

bp = Blueprint("deals", __name__, url_prefix="/api/deals")


def _sanitize_image_urls(raw, max_items=6):
    if not isinstance(raw, list):
        return []
    out = []
    for x in raw:
        if not isinstance(x, str):
            continue
        u = x.strip()
        if u and u not in out:
            out.append(u)
        if len(out) >= max_items:
            break
    return out


def _deal_owned_by_user(deal_doc, user) -> bool:
    uid = str(user["_id"])
    bid = (deal_doc.get("business_id") or "").strip()
    if bid:
        try:
            biz = db.businesses.find_one({"_id": ObjectId(bid)})
        except Exception:
            biz = None
        return bool(biz) and (biz.get("owner_user_id") or "") == uid
    name = (deal_doc.get("business_name") or "").strip()
    if not name:
        return False
    biz = db.businesses.find_one({"owner_user_id": uid, "name": name})
    return biz is not None


def _normalize_deal_dates(payload):
    no_end = bool(payload.get("no_end_date", False))
    expires = "" if no_end else (payload.get("expires") or "").strip()
    valid_from = (payload.get("valid_from") or "").strip()
    return valid_from, expires, no_end


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
    business_id = (payload.get("business_id") or "").strip()

    if not title:
        return jsonify({"error": "Deal title is required."}), 400

    # If business_id is provided, enforce ownership and use canonical business name.
    if business_id:
        try:
            biz_obj = ObjectId(business_id)
        except Exception:
            return jsonify({"error": "Invalid business_id"}), 400

        biz = db.businesses.find_one({"_id": biz_obj})
        if not biz:
            return jsonify({"error": "Business not found."}), 404
        if (biz.get("owner_user_id") or "") != str(user["_id"]):
            return jsonify({"error": "You can only add deals to your own business."}), 403

        business_name = (biz.get("name") or "").strip()

    if not business_name:
        return jsonify({"error": "business_name is required."}), 400

    valid_from, expires, no_end_date = _normalize_deal_dates(payload)

    deal = {
        "title": title,
        "business_id": business_id or None,
        "business_name": business_name,
        "description": payload.get("description", ""),
        # Keep backend payload fields flexible for older frontend/code.
        "deal_type": payload.get("deal_type", payload.get("type", "Student Deal")),
        "expires": expires,
        "valid_from": valid_from,
        "no_end_date": no_end_date,
        "image_urls": _sanitize_image_urls(payload.get("image_urls") or []),
        "student_only": bool(payload.get("student_only", False)),
        "created_by_user_id": str(user["_id"]),
    }
    result = db.deals.insert_one(deal)
    deal["_id"] = result.inserted_id
    return jsonify(serialize_deal(deal)), 201


@bp.put("/<deal_id>")
@account_type_required("business")
def update_deal(user, deal_id):
    try:
        obj_id = ObjectId(deal_id)
    except Exception:
        return jsonify({"error": "Invalid deal id"}), 400

    existing = db.deals.find_one({"_id": obj_id})
    if not existing:
        return jsonify({"error": "Deal not found."}), 404

    if not _deal_owned_by_user(existing, user):
        return jsonify({"error": "You can only edit deals for your own business."}), 403

    payload = request.get_json(force=True) or {}

    if "title" in payload:
        title = (payload.get("title") or "").strip()
    else:
        title = (existing.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Deal title is required."}), 400

    description = payload["description"] if "description" in payload else existing.get("description", "")
    deal_type = payload["deal_type"] if "deal_type" in payload else (
        existing.get("deal_type") or existing.get("type") or "Student Deal"
    )

    if "valid_from" in payload or "expires" in payload or "no_end_date" in payload:
        merged_date_payload = {
            "valid_from": payload["valid_from"] if "valid_from" in payload else existing.get("valid_from"),
            "expires": payload["expires"] if "expires" in payload else existing.get("expires"),
            "no_end_date": payload["no_end_date"] if "no_end_date" in payload else existing.get("no_end_date", False),
        }
        valid_from, expires, no_end_date = _normalize_deal_dates(merged_date_payload)
    else:
        valid_from = (existing.get("valid_from") or "").strip()
        no_end_date = bool(existing.get("no_end_date", False))
        expires = "" if no_end_date else (existing.get("expires") or "").strip()

    if "image_urls" in payload:
        image_urls = _sanitize_image_urls(payload.get("image_urls") or [])
    else:
        image_urls = existing.get("image_urls") or []

    if "student_only" in payload:
        student_only = bool(payload.get("student_only"))
    else:
        student_only = bool(existing.get("student_only", False))

    updates = {
        "title": title,
        "description": description,
        "deal_type": deal_type,
        "valid_from": valid_from,
        "expires": expires,
        "no_end_date": no_end_date,
        "image_urls": image_urls,
        "student_only": student_only,
    }

    db.deals.update_one({"_id": obj_id}, {"$set": updates})
    refreshed = db.deals.find_one({"_id": obj_id})
    return jsonify(serialize_deal(refreshed)), 200


@bp.delete("/<deal_id>")
@account_type_required("business")
def delete_deal(user, deal_id):
    try:
        obj_id = ObjectId(deal_id)
    except Exception:
        return jsonify({"error": "Invalid deal id"}), 400

    existing = db.deals.find_one({"_id": obj_id})
    if not existing:
        return jsonify({"error": "Deal not found."}), 404

    if not _deal_owned_by_user(existing, user):
        return jsonify({"error": "You can only delete deals for your own business."}), 403

    db.deals.delete_one({"_id": obj_id})
    return jsonify({"message": "Deal deleted."}), 200
