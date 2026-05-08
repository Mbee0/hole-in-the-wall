from collections import Counter
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Optional

from bson import ObjectId
from flask import Blueprint, jsonify, request

from config import Config
from services.db import (
    business_inquiries_collection,
    businesses_collection,
    deals_collection,
    users_collection,
)

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _admin_key_ok() -> bool:
    admin_key = request.headers.get("X-Admin-Api-Key", "")
    return bool(Config.ADMIN_API_KEY) and admin_key == Config.ADMIN_API_KEY


def admin_key_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not _admin_key_ok():
            return jsonify({"error": "Unauthorized"}), 401
        return fn(*args, **kwargs)

    return wrapper


SUSPICIOUS_HINTS = ("spam", "abuse", "bot", "scrape", "hack", "exploit")


def _parse_ts(entry: dict):
    ts = entry.get("ts")
    if not ts or not isinstance(ts, str):
        return None
    try:
        s = ts.replace("Z", "+00:00") if ts.endswith("Z") else ts
        return datetime.fromisoformat(s)
    except Exception:
        return None


def _analyze_activity(log: Optional[list]):
    log = log or []
    now = datetime.now(timezone.utc)
    reasons = []
    hour_ago = now - timedelta(hours=1)
    day_ago = now - timedelta(hours=24)

    for entry in log[-120:]:
        action = (entry.get("action") or "").lower()
        meta = entry.get("metadata") or {}
        meta_blob = str(meta).lower() if isinstance(meta, dict) else ""
        for hint in SUSPICIOUS_HINTS:
            if hint in action or hint in meta_blob:
                reasons.append(f"Flagged term in activity: {hint}")
                break

    in_hour = 0
    in_day = 0
    for entry in log:
        dt = _parse_ts(entry)
        if not dt:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if dt >= hour_ago:
            in_hour += 1
        if dt >= day_ago:
            in_day += 1

    if in_hour >= 35:
        reasons.append(f"Very high activity: {in_hour} events in the last hour")
    elif in_hour >= 22:
        reasons.append(f"Elevated activity: {in_hour} events in the last hour")

    if in_day >= 120:
        reasons.append(f"Very high daily activity: {in_day} events in the last 24 hours")
    elif in_day >= 85:
        reasons.append(f"Elevated daily activity: {in_day} events in the last 24 hours")

    recent_keys = []
    for entry in log:
        dt = _parse_ts(entry)
        if not dt:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if dt >= hour_ago:
            recent_keys.append(
                (entry.get("action"), entry.get("entity_type"), entry.get("entity_id"))
            )
    for (action, _et, _eid), count in Counter(recent_keys).most_common(3):
        if count >= 25 and action:
            reasons.append(f"Repeated identical activity ({count}x in 1h): {action}")

    reasons = list(dict.fromkeys(reasons))[:10]
    flagged = len(reasons) > 0
    return {
        "flagged": flagged,
        "reasons": reasons,
        "events_last_hour": in_hour,
        "events_last_24h": in_day,
        "total_logged_events": len(log),
    }


def _dt_iso(dt):
    if not dt:
        return None
    if getattr(dt, "tzinfo", None) is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _serialize_inquiry(doc: dict):
    return {
        "id": str(doc["_id"]),
        "email": doc.get("email"),
        "phone_number": doc.get("phone_number"),
        "inquirer_name": doc.get("inquirer_name"),
        "business_name": doc.get("business_name"),
        "deal_types": doc.get("deal_types") or [],
        "blurb": doc.get("blurb"),
        "status": doc.get("status"),
        "submitted_at": _dt_iso(doc.get("submitted_at")),
        "approved_at": _dt_iso(doc.get("approved_at")),
        "onboarded_at": _dt_iso(doc.get("onboarded_at")),
    }


def _deal_created_at(deal_doc: dict):
    oid = deal_doc.get("_id")
    if oid is None:
        return None
    try:
        gt = oid.generation_time
        if gt.tzinfo is None:
            gt = gt.replace(tzinfo=timezone.utc)
        return gt
    except Exception:
        return None


def _deals_for_business(biz: dict):
    bid = str(biz["_id"])
    bname = (biz.get("name") or "").strip()
    or_clauses = [{"business_id": bid}]
    try:
        or_clauses.append({"business_id": ObjectId(bid)})
    except Exception:
        pass
    if bname:
        or_clauses.append({"business_name": bname})
    return list(deals_collection.find({"$or": or_clauses}))


@admin_bp.get("/users")
@admin_key_required
def admin_users():
    users = list(users_collection.find({}))
    out = []
    for u in users:
        log = u.get("activity_log") or []
        suspicion = _analyze_activity(log)
        out.append(
            {
                "id": str(u["_id"]),
                "name": u.get("name") or "",
                "account_type": u.get("account_type"),
                "suspicious": suspicion,
            }
        )
    out.sort(key=lambda row: (not row["suspicious"]["flagged"], (row["name"] or "").lower()))
    return jsonify({"users": out}), 200


@admin_bp.get("/businesses")
@admin_key_required
def admin_businesses():
    pending = list(
        business_inquiries_collection.find({"status": "pending"}).sort("submitted_at", -1)
    )
    awaiting_code_use = list(
        business_inquiries_collection.find({"status": "approved"}).sort("approved_at", -1)
    )

    biz_docs = list(businesses_collection.find({}))
    out_businesses = []
    for biz in biz_docs:
        owner_id = biz.get("owner_user_id")
        owner = None
        if owner_id:
            try:
                owner = users_collection.find_one({"_id": ObjectId(owner_id)})
            except Exception:
                owner = None

        deals = _deals_for_business(biz)
        posts = len(deals)
        last_post = None
        for d in deals:
            ct = _deal_created_at(d)
            if ct and (last_post is None or ct > last_post):
                last_post = ct

        out_businesses.append(
            {
                "id": str(biz["_id"]),
                "name": biz.get("name"),
                "category": biz.get("category"),
                "address": biz.get("address"),
                "story": biz.get("story", ""),
                "claimed": biz.get("claimed", False),
                "deal_summary": biz.get("deal_summary", ""),
                "lat": biz.get("lat"),
                "lng": biz.get("lng"),
                "offer_types": biz.get("offer_types", []),
                "deal_focus": biz.get("deal_focus", []),
                "owner_user_id": owner_id,
                "owner_name": (owner or {}).get("name"),
                "owner_email": (owner or {}).get("email"),
                "activity": {
                    "posts_created": posts,
                    "last_post_at": _dt_iso(last_post),
                },
            }
        )

    out_businesses.sort(
        key=lambda b: b["activity"]["last_post_at"] or "",
        reverse=True,
    )

    return jsonify(
        {
            "pending_inquiries": [_serialize_inquiry(d) for d in pending],
            "awaiting_onboarding": [_serialize_inquiry(d) for d in awaiting_code_use],
            "businesses": out_businesses,
        }
    ), 200
