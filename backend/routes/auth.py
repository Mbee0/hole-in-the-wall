from flask import Blueprint, request, jsonify, session
from bson import ObjectId
from services.db import users_collection
from services.auth_helpers import hash_password, verify_password, serialize_user

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")
bp = auth_bp

def _set_session_user(user_doc):
    # Store as string so it survives JSON/cookie encoding cleanly.
    session["user_id"] = str(user_doc["_id"])

@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    account_type = data.get("account_type")  # consumer, business, school

    if not name or not email or not password or not account_type:
        return jsonify({"error": "Missing required fields"}), 400

    # Students and business accounts are onboarded via code/inquiry flows.
    if account_type == "consumer":
        return jsonify({"error": "Student signup requires .edu verification. Use /api/auth/student/verify/start"}), 400
    if account_type == "business":
        return jsonify({"error": "Business accounts require an inquiry + approval. Use /api/business-inquiries"}), 400

    allowed_account_types = {"consumer", "business", "school"}
    if account_type not in allowed_account_types:
        return jsonify({"error": "Invalid account_type"}), 400

    existing_user = users_collection.find_one({"email": email})
    if existing_user:
        return jsonify({"error": "User already exists"}), 409

    preferences = data.get("preferences", {}) or {}
    if not isinstance(preferences, dict):
        return jsonify({"error": "preferences must be an object"}), 400

    new_user = {
        "name": name,
        "email": email,
        "password": hash_password(password),
        "account_type": account_type,
        "school_email_verified": email.endswith(".edu"),
        "school_name": data.get("school_name", ""),
        "preferences": preferences,
        "activity_log": [],
        "saved_deals": [],
    }

    result = users_collection.insert_one(new_user)
    created_user = users_collection.find_one({"_id": result.inserted_id})

    _set_session_user(created_user)

    return jsonify({
        "message": "User created successfully",
        "user": serialize_user(created_user)
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Missing email or password"}), 400

    user = users_collection.find_one({"email": email})

    if not user or not verify_password(password, user["password"]):
        return jsonify({"error": "Invalid email or password"}), 401

    if user.get("account_type") == "consumer" and not user.get("school_email_verified", False):
        return jsonify({"error": "Please verify your .edu email before logging in."}), 403

    _set_session_user(user)

    return jsonify({
        "message": "Login successful",
        "user": serialize_user(user)
    }), 200


@auth_bp.route("/register", methods=["POST"])
def register_alias():
    # Backwards-compatible alias for README / older frontend code.
    return signup()


@auth_bp.route("/me", methods=["GET"])
def me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"user": None}), 200

    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        user = None

    if not user:
        session.pop("user_id", None)
        return jsonify({"user": None}), 200

    return jsonify({"user": serialize_user(user)}), 200


@auth_bp.route("/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"message": "Logged out"}), 200