from werkzeug.security import generate_password_hash, check_password_hash

def hash_password(password):
    return generate_password_hash(password)

def verify_password(password, hashed_password):
    return check_password_hash(hashed_password, password)

def serialize_user(user):
    return {
        "id": str(user["_id"]),
        "name": user.get("name"),
        "email": user.get("email"),
        "account_type": user.get("account_type"),
        "school_email_verified": user.get("school_email_verified", False),
        "school_name": user.get("school_name"),
    }

def serialize_business(business):
    return {
        "id": str(business["_id"]),
        "owner_user_id": business.get("owner_user_id"),
        "name": business.get("name"),
        "category": business.get("category"),
        "address": business.get("address"),
        "claimed": business.get("claimed", False),
        "story": business.get("story"),
        "tags": business.get("tags", []),
    }

def serialize_deal(deal):
    return {
        "id": str(deal["_id"]),
        "business_id": deal.get("business_id"),
        "title": deal.get("title"),
        "description": deal.get("description"),
        "deal_type": deal.get("deal_type"),
        "audience": deal.get("audience"),
        "active": deal.get("active", True),
    }