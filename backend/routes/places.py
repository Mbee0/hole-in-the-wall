"""
Address suggestions via Mapbox Geocoding (recommended) or OpenStreetMap Nominatim (fallback).

Mapbox: set MAPBOX_ACCESS_TOKEN in .env — keeps keys server-side and improves match quality.
Nominatim: free; respect https://operations.osmfoundation.org/policies/nominatim/ (low volume, attribution on maps).
"""
import json
import urllib.error
import urllib.parse
import urllib.request

from flask import Blueprint, jsonify, request

from config import Config

bp = Blueprint("places", __name__, url_prefix="/api/places")


def _mapbox_suggestions(query: str, limit: int):
    token = (Config.MAPBOX_ACCESS_TOKEN or "").strip()
    if not token:
        return []

    encoded = urllib.parse.quote(query)
    # address + poi covers street addresses and named venues
    url = (
        f"https://api.mapbox.com/geocoding/v5/mapbox.places/{encoded}.json"
        f"?access_token={urllib.parse.quote(token)}"
        f"&limit={limit}&types=address,poi"
    )
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return []

    out = []
    for feat in data.get("features") or []:
        geom = feat.get("geometry") or {}
        coords = geom.get("coordinates") or [None, None]
        lng, lat = coords[0], coords[1]
        label = feat.get("place_name") or ""
        if not label or lat is None or lng is None:
            continue
        out.append(
            {
                "id": feat.get("id") or "",
                "label": label,
                "formatted_address": label,
                "lat": float(lat),
                "lng": float(lng),
                "provider": "mapbox",
            }
        )
    return out


def _nominatim_suggestions(query: str, limit: int):
    """Fallback geocoder; include NOMINATIM_USER_AGENT identifying your app."""
    params = urllib.parse.urlencode(
        {
            "q": query,
            "format": "json",
            "limit": min(max(limit, 1), 10),
            "addressdetails": "1",
        }
    )
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    ua = (Config.NOMINATIM_USER_AGENT or "").strip() or "HoleInTheWall/1.0"
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": ua})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            rows = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return []

    out = []
    for item in rows or []:
        try:
            lat = float(item.get("lat"))
            lng = float(item.get("lon"))
        except (TypeError, ValueError):
            continue
        label = item.get("display_name") or ""
        if not label:
            continue
        pid = item.get("place_id")
        out.append(
            {
                "id": str(pid) if pid is not None else "",
                "label": label,
                "formatted_address": label,
                "lat": lat,
                "lng": lng,
                "provider": "nominatim",
            }
        )
    return out


@bp.get("/autocomplete")
def address_autocomplete():
    q = (request.args.get("q") or "").strip()
    if len(q) < 3:
        return jsonify({"suggestions": [], "message": "Enter at least 3 characters."}), 200

    limit = request.args.get("limit", "8")
    try:
        limit_n = min(max(int(limit), 1), 10)
    except ValueError:
        limit_n = 8

    suggestions = _mapbox_suggestions(q, limit_n)
    provider_used = "mapbox" if suggestions else None

    if not suggestions:
        suggestions = _nominatim_suggestions(q, limit_n)
        provider_used = "nominatim"

    return jsonify({"suggestions": suggestions, "provider": provider_used}), 200
