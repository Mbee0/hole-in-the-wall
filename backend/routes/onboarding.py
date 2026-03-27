from datetime import datetime, timedelta, timezone
import hashlib
import random

from bson import ObjectId
from flask import Blueprint, jsonify, request, session

from config import Config
from services.auth_helpers import hash_password, serialize_user
from services.db import (
    student_email_verifications_collection,
    business_inquiries_collection,
    users_collection,
)
from services.emailer import send_email


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


def _generate_6_digit_code() -> str:
    return f"{random.randint(100000, 999999)}"


def _code_hash(code: str, email: str) -> str:
    # Hash the code before storing so the DB doesn't contain plaintext codes.
    # SECRET_KEY is used as an additional secret component.
    material = f"{code}:{email}:{Config.SECRET_KEY}"
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def _set_session_user(user_doc):
    session["user_id"] = str(user_doc["_id"])


def _now_utc():
    return datetime.now(timezone.utc)


student_verify_bp = Blueprint("student_verify", __name__, url_prefix="/api/auth/student/verify")
business_inquiries_bp = Blueprint(
    "business_inquiries", __name__, url_prefix="/api/business-inquiries"
)
business_verify_bp = Blueprint("business_verify", __name__, url_prefix="/api/auth/business/verify")


@student_verify_bp.route("/start", methods=["POST"])
def student_verify_start():
    try:
        data = request.get_json(force=True) or {}
        email = _normalize_email(data.get("email"))

        if not email:
            return jsonify({"error": "email is required"}), 400
        if not email.endswith(".edu"):
            return jsonify({"error": "Please use a .edu email"}), 400

        existing_user = users_collection.find_one({"email": email})
        if existing_user and existing_user.get("account_type") == "consumer":
            return jsonify({"error": "A student account already exists for this email"}), 409

        code = _generate_6_digit_code()
        expires_at = _now_utc() + timedelta(minutes=Config.EMAIL_CODE_EXPIRES_MINUTES)
        ver_doc = {
            "email": email,
            "code_hash": _code_hash(code, email),
            "expires_at": expires_at,
            "purpose": "student_signup",
            "created_at": _now_utc(),
        }

        # Replace any existing pending verification for the email.
        student_email_verifications_collection.delete_many({"email": email, "purpose": "student_signup"})
        student_email_verifications_collection.insert_one(ver_doc)

        try:
            send_email(
                to_email=email,
                subject="Hole in the Wall: Your verification code",
                body_text=f"Your verification code is: {code}\n\n"
                          f"It expires in {Config.EMAIL_CODE_EXPIRES_MINUTES} minutes.",
            )
        except Exception as exc:
            # Avoid 500s for SMTP/provider issues; give a clear actionable error.
            return jsonify({"error": f"Could not send verification email: {str(exc)}"}), 502

        return jsonify({"message": "Verification code sent"}), 200
    except Exception as exc:
        if getattr(Config, "FLASK_ENV", "development") == "development":
            return jsonify({"error": f"Database unavailable. Check MongoDB connection. Details: {str(exc)}"}), 503
        return jsonify({"error": "Database unavailable. Check MongoDB connection."}), 503


@student_verify_bp.route("/confirm", methods=["POST"])
def student_verify_confirm():
    try:
        data = request.get_json(force=True) or {}
        email = _normalize_email(data.get("email"))
        code = (data.get("code") or "").strip()
        name = (data.get("name") or "").strip()
        password = data.get("password")
        preferences = data.get("preferences", {}) or {}

        if not email or not code or not name or not password:
            return jsonify({"error": "Missing required fields"}), 400
        if not email.endswith(".edu"):
            return jsonify({"error": "Please use a .edu email"}), 400
        if not isinstance(preferences, dict):
            return jsonify({"error": "preferences must be an object"}), 400

        if not Config.STUDENT_VERIFY_BYPASS:
            code_doc = student_email_verifications_collection.find_one(
                {"email": email, "purpose": "student_signup", "expires_at": {"$gt": _now_utc()}}
            )
            if not code_doc:
                return jsonify({"error": "Invalid or expired code"}), 400

            expected_hash = _code_hash(code, email)
            if code_doc.get("code_hash") != expected_hash:
                return jsonify({"error": "Invalid or expired code"}), 400

        if users_collection.find_one({"email": email}):
            return jsonify({"error": "Account already exists"}), 409

        school_domain = email.split("@", 1)[1] if "@" in email else ""
        school_name = school_domain.split(".")[0] if school_domain else ""

        new_user = {
            "name": name,
            "email": email,
            "password": hash_password(password),
            "account_type": "consumer",
            "school_email_verified": True,
            "school_name": school_name,
            "preferences": preferences,
            "activity_log": [],
            "saved_deals": [],
        }

        result = users_collection.insert_one(new_user)
        created_user = users_collection.find_one({"_id": result.inserted_id})

        # Invalidate verification code(s) after successful signup.
        student_email_verifications_collection.delete_many({"email": email, "purpose": "student_signup"})

        _set_session_user(created_user)
        return jsonify({"message": "Student account verified and created", "user": serialize_user(created_user)}), 201
    except Exception as exc:
        if getattr(Config, "FLASK_ENV", "development") == "development":
            return jsonify({"error": f"Database unavailable. Check MongoDB connection. Details: {str(exc)}"}), 503
        return jsonify({"error": "Database unavailable. Check MongoDB connection."}), 503


@business_inquiries_bp.route("", methods=["POST"])
def create_business_inquiry():
    data = request.get_json(force=True) or {}

    email = _normalize_email(data.get("email"))
    phone_number = (data.get("phone_number") or "").strip()
    inquirer_name = (data.get("inquirer_name") or "").strip()
    business_name = (data.get("business_name") or "").strip()
    deal_types = data.get("deal_types") or []
    blurb = (data.get("blurb") or "").strip()

    if not email or not phone_number or not inquirer_name or not business_name or not blurb:
        return jsonify({"error": "Missing required fields"}), 400
    if not isinstance(deal_types, list) or not deal_types:
        return jsonify({"error": "deal_types must be a non-empty list"}), 400

    inquiry_doc = {
        "email": email,
        "phone_number": phone_number,
        "inquirer_name": inquirer_name,
        "business_name": business_name,
        "deal_types": deal_types,
        "blurb": blurb,
        "status": "pending",
        "submitted_at": _now_utc(),
    }

    result = business_inquiries_collection.insert_one(inquiry_doc)
    return jsonify({"message": "Inquiry submitted. Awaiting approval.", "id": str(result.inserted_id)}), 201


@business_inquiries_bp.route("/<inquiry_id>/approve", methods=["POST"])
def approve_business_inquiry(inquiry_id: str):
    admin_key = request.headers.get("X-Admin-Api-Key", "")
    if not Config.ADMIN_API_KEY or admin_key != Config.ADMIN_API_KEY:
        return jsonify({"error": "Unauthorized"}), 401

    try:
        inquiry = business_inquiries_collection.find_one({"_id": ObjectId(inquiry_id)})
    except Exception:
        inquiry = None

    if not inquiry:
        return jsonify({"error": "Inquiry not found"}), 404
    if inquiry.get("status") != "pending":
        return jsonify({"error": "Inquiry is not pending"}), 400

    code = _generate_6_digit_code()
    expires_at = _now_utc() + timedelta(minutes=Config.EMAIL_CODE_EXPIRES_MINUTES)

    business_inquiries_collection.update_one(
        {"_id": inquiry["_id"]},
        {
            "$set": {
                "status": "approved",
                "onboarding_code_hash": _code_hash(code, inquiry["email"]),
                "onboarding_code_expires_at": expires_at,
                "approved_at": _now_utc(),
            }
        },
    )

    try:
        send_email(
            to_email=inquiry["email"],
            subject="Hole in the Wall: Your business onboarding code",
            body_text=f"Your business onboarding code is: {code}\n\n"
                      f"Use it to create your restaurant account password.\n\n"
                      f"It expires in {Config.EMAIL_CODE_EXPIRES_MINUTES} minutes.",
        )
    except Exception as exc:
        return jsonify({"error": f"Inquiry approved, but onboarding email failed: {str(exc)}"}), 502

    return jsonify({"message": "Inquiry approved. Onboarding email sent."}), 200


@business_verify_bp.route("/confirm", methods=["POST"])
def business_verify_confirm():
    data = request.get_json(force=True) or {}
    email = _normalize_email(data.get("email"))
    code = (data.get("code") or "").strip()
    password = data.get("password")

    if not email or not code or not password:
        return jsonify({"error": "Missing required fields"}), 400

    inquiry = business_inquiries_collection.find_one(
        {
            "email": email,
            "status": "approved",
            "onboarding_code_expires_at": {"$gt": _now_utc()},
        }
    )

    if not inquiry:
        return jsonify({"error": "Invalid or expired code"}), 400

    expected_hash = _code_hash(code, email)
    if inquiry.get("onboarding_code_hash") != expected_hash:
        return jsonify({"error": "Invalid or expired code"}), 400

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "Account already exists"}), 409

    new_user = {
        "name": inquiry.get("business_name"),
        "email": email,
        "password": hash_password(password),
        "account_type": "business",
        "school_email_verified": False,
        "school_name": "",
        "preferences": {},
        "activity_log": [],
        "saved_deals": [],
    }

    result = users_collection.insert_one(new_user)
    created_user = users_collection.find_one({"_id": result.inserted_id})

    business_inquiries_collection.update_one(
        {"_id": inquiry["_id"]},
        {
            "$set": {
                "status": "onboarded",
                "onboarded_user_id": str(created_user["_id"]),
                "onboarded_at": _now_utc(),
            }
        },
    )

    _set_session_user(created_user)
    return jsonify({"message": "Business account created", "user": serialize_user(created_user)}), 201

