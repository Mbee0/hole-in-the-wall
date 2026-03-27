from datetime import datetime, timedelta, timezone
import hashlib
import random

from flask import Blueprint, jsonify, request

from config import Config
from services.auth_helpers import hash_password
from services.db import password_reset_codes_collection, users_collection
from services.emailer import send_email

bp = Blueprint("password_reset", __name__, url_prefix="/api/auth/password")


def _now_utc():
    return datetime.now(timezone.utc)


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _generate_6_digit_code() -> str:
    return f"{random.randint(100000, 999999)}"


def _code_hash(code: str, email: str) -> str:
    material = f"{code}:{email}:{Config.SECRET_KEY}:password_reset"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


@bp.route("/reset/start", methods=["POST"])
def reset_start():
    data = request.get_json(force=True) or {}
    email = _normalize_email(data.get("email"))
    if not email:
        return jsonify({"error": "email is required"}), 400

    user = users_collection.find_one({"email": email})
    # Avoid account enumeration: respond success either way.
    if not user:
        return jsonify({"message": "If the account exists, a reset code was sent."}), 200

    code = _generate_6_digit_code()
    expires_at = _now_utc() + timedelta(minutes=Config.EMAIL_CODE_EXPIRES_MINUTES)

    password_reset_codes_collection.delete_many({"email": email})
    password_reset_codes_collection.insert_one(
        {
            "email": email,
            "code_hash": _code_hash(code, email),
            "expires_at": expires_at,
            "created_at": _now_utc(),
        }
    )

    try:
        send_email(
            to_email=email,
            subject="Hole in the Wall: Password reset code",
            body_text=f"Your password reset code is: {code}\n\n"
                      f"It expires in {Config.EMAIL_CODE_EXPIRES_MINUTES} minutes.",
        )
    except Exception as exc:
        return jsonify({"error": f"Could not send reset email: {str(exc)}"}), 502

    return jsonify({"message": "If the account exists, a reset code was sent."}), 200


@bp.route("/reset/confirm", methods=["POST"])
def reset_confirm():
    data = request.get_json(force=True) or {}
    email = _normalize_email(data.get("email"))
    code = (data.get("code") or "").strip()
    new_password = data.get("new_password") or ""

    if not email or not code or not new_password:
        return jsonify({"error": "Missing required fields"}), 400

    doc = password_reset_codes_collection.find_one(
        {"email": email, "expires_at": {"$gt": _now_utc()}}
    )
    if not doc:
        return jsonify({"error": "Invalid or expired reset code"}), 400

    if doc.get("code_hash") != _code_hash(code, email):
        return jsonify({"error": "Invalid or expired reset code"}), 400

    user = users_collection.find_one({"email": email})
    if not user:
        return jsonify({"error": "Account not found"}), 404

    users_collection.update_one(
        {"_id": user["_id"]},
        {"$set": {"password": hash_password(new_password)}},
    )
    password_reset_codes_collection.delete_many({"email": email})

    return jsonify({"message": "Password reset successful. You can log in now."}), 200

