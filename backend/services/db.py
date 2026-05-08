import certifi
from pymongo import MongoClient

from config import Config

DB_INIT_ERROR = None


def _mongo_uses_tls(uri: str) -> bool:
    u = (uri or "").strip().lower()
    if u.startswith("mongodb+srv://"):
        return True
    if "tls=true" in u or "ssl=true" in u:
        return True
    if ".mongodb.net" in u:
        return True
    return False


def _mongo_client_kwargs():
    uri = (Config.MONGO_URI or "").strip()
    kwargs = {
        "serverSelectionTimeoutMS": 5000,
        "connectTimeoutMS": 5000,
        "socketTimeoutMS": 5000,
    }
    # Minimal containers often lack a full CA store; certifi fixes many Atlas TLS failures on Render.
    if _mongo_uses_tls(uri):
        kwargs["tlsCAFile"] = certifi.where()
    if getattr(Config, "MONGO_TLS_DISABLE_OCSP", False):
        kwargs["tlsDisableOCSPEndpointCheck"] = True
    return kwargs

class _UnavailableCollection:
    def __getattr__(self, _name):
        def _raise(*_args, **_kwargs):
            base = "Database unavailable. Check MongoDB connection."
            if DB_INIT_ERROR:
                raise RuntimeError(f"{base} Init error: {DB_INIT_ERROR}")
            raise RuntimeError(base)
        return _raise


class _UnavailableDB:
    businesses = _UnavailableCollection()
    deals = _UnavailableCollection()

    def __getitem__(self, _name):
        return _UnavailableCollection()


try:
    client = MongoClient(Config.MONGO_URI, **_mongo_client_kwargs())
    db = client[Config.MONGO_DB]
except Exception as exc:
    DB_INIT_ERROR = str(exc)
    client = None
    db = _UnavailableDB()

users_collection = db["users"]
businesses_collection = db["businesses"]
deals_collection = db["deals"]
student_email_verifications_collection = db["student_email_verifications"]
business_inquiries_collection = db["business_inquiries"]
password_reset_codes_collection = db["password_reset_codes"]

# Ensure email uniqueness at the database layer (optional; can be disabled in CI).
if getattr(Config, "MONGO_CREATE_INDEXES", False):
    try:
        users_collection.create_index("email", unique=True)
    except Exception:
        # Avoid hard failing if the database already contains duplicate emails.
        pass

    # Verification codes should expire; index to speed lookups.
    try:
        student_email_verifications_collection.create_index("email")
        student_email_verifications_collection.create_index("expires_at")
    except Exception:
        pass

    try:
        business_inquiries_collection.create_index("email")
        business_inquiries_collection.create_index("status")
        business_inquiries_collection.create_index("onboarding_code_expires_at")
    except Exception:
        pass

    try:
        password_reset_codes_collection.create_index("email")
        password_reset_codes_collection.create_index("expires_at")
    except Exception:
        pass