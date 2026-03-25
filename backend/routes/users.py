from flask import Blueprint, jsonify
from bson import ObjectId
from services.db import users_collection
from services.auth_helpers import serialize_user

users_bp = Blueprint("users", __name__, url_prefix="/api/users")

@users_bp.route("/<user_id>", methods=["GET"])
def get_user(user_id):
    try:
        user = users_collection.find_one({"_id": ObjectId(user_id)})
        if not user:
            return jsonify({"error": "User not found"}), 404

        return jsonify(serialize_user(user)), 200
    except Exception:
        return jsonify({"error": "Invalid user ID"}), 400