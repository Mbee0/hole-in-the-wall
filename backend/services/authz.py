from functools import wraps

from bson import ObjectId
from flask import jsonify, session

from services.db import users_collection


def _get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    try:
        return users_collection.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None


def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        user = _get_current_user()
        if not user:
            return jsonify({"error": "Unauthorized"}), 401
        return fn(*args, user=user, **kwargs)

    return wrapper


def account_type_required(expected_account_type: str):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            user = _get_current_user()
            if not user:
                return jsonify({"error": "Unauthorized"}), 401
            if user.get("account_type") != expected_account_type:
                return jsonify({"error": "Forbidden"}), 403
            return fn(*args, user=user, **kwargs)

        return wrapper

    return decorator

