from flask import Blueprint, request, jsonify
from services.db import users_collection
from services.auth_helpers import hash_password, verify_password, serialize_user

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    account_type = data.get("account_type")  # consumer, business, school

    if not name or not email or not password or not account_type:
        return jsonify({"error": "Missing required fields"}), 400

    existing_user = users_collection.find_one({"email": email})
    if existing_user:
        return jsonify({"error": "User already exists"}), 409

    new_user = {
        "name": name,
        "email": email,
        "password": hash_password(password),
        "account_type": account_type,
        "school_email_verified": email.endswith(".edu"),
        "school_name": data.get("school_name", ""),
    }

    result = users_collection.insert_one(new_user)
    created_user = users_collection.find_one({"_id": result.inserted_id})

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

    return jsonify({
        "message": "Login successful",
        "user": serialize_user(user)
    }), 200