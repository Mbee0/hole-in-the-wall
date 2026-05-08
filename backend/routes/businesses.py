import secrets

from flask import Blueprint, jsonify, request
from bson import ObjectId
from services.db import db
from services.authz import account_type_required

bp = Blueprint("businesses", __name__, url_prefix="/api/businesses")


def _sanitize_url_list(raw, max_items=12):
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


def _coerce_coord(value):
    """Accept floats, ints, or numeric strings; return float or None."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _new_location_id() -> str:
    return f"loc_{secrets.token_hex(6)}"


def _normalize_locations_payload(raw, max_items=10):
    """
    Accept a list of incoming location dicts and return a sanitized list.
    Each entry needs at least an address. Coordinates become floats or None.
    Exactly one entry is marked is_primary=True.
    """
    if not isinstance(raw, list):
        return []

    cleaned = []
    for item in raw[:max_items]:
        if not isinstance(item, dict):
            continue
        address = (item.get("address") or "").strip()
        if not address:
            continue
        loc = {
            "id": str(item.get("id") or "").strip() or _new_location_id(),
            "label": (item.get("label") or "").strip(),
            "address": address,
            "lat": _coerce_coord(item.get("lat")),
            "lng": _coerce_coord(item.get("lng")),
            "phone": (item.get("phone") or "").strip(),
            "is_primary": bool(item.get("is_primary", False)),
        }
        cleaned.append(loc)

    if not cleaned:
        return []

    primary_idx = next((i for i, l in enumerate(cleaned) if l["is_primary"]), 0)
    for i, loc in enumerate(cleaned):
        loc["is_primary"] = i == primary_idx
    return cleaned


def _ensure_locations_with_legacy(doc, locations_input):
    """
    Build the final locations array, falling back to legacy top-level fields when
    the client has not yet sent any locations entries. This keeps older businesses working.
    """
    if locations_input:
        return locations_input

    existing = doc.get("locations") if doc else None
    if isinstance(existing, list) and existing:
        # Re-normalize just to backfill ids and ensure exactly one primary.
        return _normalize_locations_payload(existing)

    legacy_address = (doc or {}).get("address") if doc else None
    legacy_lat = (doc or {}).get("lat")
    legacy_lng = (doc or {}).get("lng")
    legacy_phone = (doc or {}).get("phone") or ""
    if legacy_address:
        return [
            {
                "id": _new_location_id(),
                "label": "",
                "address": legacy_address,
                "lat": _coerce_coord(legacy_lat),
                "lng": _coerce_coord(legacy_lng),
                "phone": legacy_phone,
                "is_primary": True,
            }
        ]
    return []


def _primary_location(locations):
    if not locations:
        return None
    for loc in locations:
        if loc.get("is_primary"):
            return loc
    return locations[0]


def serialize_business(doc):
    locations = _ensure_locations_with_legacy(doc, [])
    primary = _primary_location(locations) or {}
    # Mirror the primary location to top-level fields so older clients keep working.
    primary_address = primary.get("address") or doc.get("address") or ""
    primary_lat = primary.get("lat") if primary else doc.get("lat")
    primary_lng = primary.get("lng") if primary else doc.get("lng")

    return {
        "id": str(doc["_id"]),
        "name": doc.get("name"),
        "category": doc.get("category"),
        "address": primary_address,
        "story": doc.get("story", ""),
        "claimed": doc.get("claimed", False),
        "deal_summary": doc.get("deal_summary", ""),
        "lat": primary_lat,
        "lng": primary_lng,
        "offer_types": doc.get("offer_types", []),  # deals/catering/fundraising
        "deal_focus": doc.get("deal_focus", []),  # meals/drinks/dessert
        "gallery_urls": doc.get("gallery_urls") or [],
        "website": doc.get("website") or "",
        "phone": doc.get("phone") or "",
        "contact_email": doc.get("contact_email") or "",
        "allow_contact_email": bool(doc.get("allow_contact_email", False)),
        "locations": locations,
    }


@bp.get("")
def get_businesses():
    category = request.args.get("category")
    query = {"category": category} if category else {}
    docs = db.businesses.find(query)
    return jsonify([serialize_business(doc) for doc in docs]), 200


@bp.get("/my")
@account_type_required("business")
def get_my_businesses(user):
    docs = list(db.businesses.find({"owner_user_id": str(user["_id"])}))
    return jsonify([serialize_business(d) for d in docs]), 200


@bp.get("/<business_id>")
def get_business(business_id):
    try:
        doc = db.businesses.find_one({"_id": ObjectId(business_id)})
    except Exception:
        doc = None

    if not doc:
        return jsonify({"error": "Business not found."}), 404

    return jsonify(serialize_business(doc)), 200


def _build_locations_for_create(payload):
    """Resolve incoming payload into a `locations` array on create."""
    explicit = _normalize_locations_payload(payload.get("locations") or [])
    if explicit:
        return explicit

    legacy_address = (payload.get("address") or "").strip()
    if not legacy_address:
        return []
    return [
        {
            "id": _new_location_id(),
            "label": "",
            "address": legacy_address,
            "lat": _coerce_coord(payload.get("lat")),
            "lng": _coerce_coord(payload.get("lng")),
            "phone": (payload.get("phone") or "").strip(),
            "is_primary": True,
        }
    ]


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

    allowed_offer_types = {"deals", "catering", "fundraising"}
    allowed_deal_focus = {"meals", "drinks", "dessert"}
    offer_types = [x for x in offer_types if isinstance(x, str) and x in allowed_offer_types]
    deal_focus = [x for x in deal_focus if isinstance(x, str) and x in allowed_deal_focus]

    locations = _build_locations_for_create(payload)
    primary = _primary_location(locations) or {}

    new_doc = {
        "name": name,
        "category": payload.get("category", "Restaurant"),
        "address": primary.get("address") or (payload.get("address") or "").strip(),
        "story": payload.get("story", ""),
        "claimed": bool(payload.get("claimed", False)),
        "deal_summary": payload.get("deal_summary", ""),
        "lat": primary.get("lat") if primary else _coerce_coord(payload.get("lat")),
        "lng": primary.get("lng") if primary else _coerce_coord(payload.get("lng")),
        "owner_user_id": str(user["_id"]),
        "offer_types": offer_types,
        "deal_focus": deal_focus,
        "gallery_urls": _sanitize_url_list(payload.get("gallery_urls") or []),
        "website": (payload.get("website") or "").strip(),
        "phone": (payload.get("phone") or "").strip(),
        "contact_email": (payload.get("contact_email") or "").strip(),
        "allow_contact_email": bool(payload.get("allow_contact_email", False)),
        "locations": locations,
    }
    result = db.businesses.insert_one(new_doc)
    new_doc["_id"] = result.inserted_id

    return jsonify(serialize_business(new_doc)), 201


@bp.put("/<business_id>")
@account_type_required("business")
def update_business(user, business_id):
    try:
        obj_id = ObjectId(business_id)
    except Exception:
        return jsonify({"error": "Invalid business id"}), 400

    existing = db.businesses.find_one({"_id": obj_id})
    if not existing:
        return jsonify({"error": "Business not found."}), 404

    if (existing.get("owner_user_id") or "") != str(user["_id"]):
        return jsonify({"error": "You can only edit your own business."}), 403

    payload = request.get_json(force=True) or {}

    offer_types = payload.get("offer_types", existing.get("offer_types", [])) or []
    deal_focus = payload.get("deal_focus", existing.get("deal_focus", [])) or []
    if not isinstance(offer_types, list):
        return jsonify({"error": "offer_types must be a list."}), 400
    if not isinstance(deal_focus, list):
        return jsonify({"error": "deal_focus must be a list."}), 400

    allowed_offer_types = {"deals", "catering", "fundraising"}
    allowed_deal_focus = {"meals", "drinks", "dessert"}
    offer_types = [x for x in offer_types if isinstance(x, str) and x in allowed_offer_types]
    deal_focus = [x for x in deal_focus if isinstance(x, str) and x in allowed_deal_focus]

    allowed_fields = {
        "name",
        "category",
        "story",
        "deal_summary",
        "claimed",
        "website",
        "phone",
        "contact_email",
        "allow_contact_email",
    }
    updates = {}
    for key in allowed_fields:
        if key in payload:
            if key == "allow_contact_email":
                updates[key] = bool(payload.get(key))
            elif key in {"website", "phone", "contact_email"}:
                updates[key] = (payload.get(key) or "").strip()
            else:
                updates[key] = payload.get(key)
    if "gallery_urls" in payload:
        updates["gallery_urls"] = _sanitize_url_list(payload.get("gallery_urls") or [])
    updates["offer_types"] = offer_types
    updates["deal_focus"] = deal_focus

    # Locations: prefer an explicit "locations" array. As a backward-compatible
    # fallback we still accept top-level address/lat/lng to update the primary location.
    if "locations" in payload:
        new_locations = _normalize_locations_payload(payload.get("locations") or [])
        updates["locations"] = new_locations
    elif any(k in payload for k in ("address", "lat", "lng")):
        existing_locations = _ensure_locations_with_legacy(existing, [])
        if not existing_locations:
            existing_locations = []
        # Treat the legacy fields as edits to the primary location.
        primary_idx = next(
            (i for i, l in enumerate(existing_locations) if l.get("is_primary")),
            0 if existing_locations else None,
        )
        merged_primary = (
            existing_locations[primary_idx].copy()
            if primary_idx is not None and existing_locations
            else {"id": _new_location_id(), "label": "", "phone": ""}
        )
        if "address" in payload:
            merged_primary["address"] = (payload.get("address") or "").strip()
        if "lat" in payload:
            merged_primary["lat"] = _coerce_coord(payload.get("lat"))
        if "lng" in payload:
            merged_primary["lng"] = _coerce_coord(payload.get("lng"))
        merged_primary["is_primary"] = True

        if not merged_primary.get("address"):
            # No address means we can't keep this location at all.
            new_locations = [
                l for i, l in enumerate(existing_locations) if i != primary_idx
            ]
        else:
            if existing_locations and primary_idx is not None:
                existing_locations[primary_idx] = merged_primary
                new_locations = existing_locations
            else:
                new_locations = [merged_primary]

        updates["locations"] = _normalize_locations_payload(new_locations)
    else:
        new_locations = _ensure_locations_with_legacy(existing, [])
        if new_locations and not isinstance(existing.get("locations"), list):
            updates["locations"] = new_locations  # backfill old doc with array

    primary = _primary_location(updates.get("locations") or _ensure_locations_with_legacy(existing, []))
    if primary:
        updates["address"] = primary.get("address") or ""
        updates["lat"] = primary.get("lat")
        updates["lng"] = primary.get("lng")

    if not updates:
        return jsonify(serialize_business(existing)), 200

    db.businesses.update_one({"_id": obj_id}, {"$set": updates})
    updated = db.businesses.find_one({"_id": obj_id})
    return jsonify(serialize_business(updated)), 200
