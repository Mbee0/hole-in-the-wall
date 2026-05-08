how can i import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    FLASK_ENV = os.getenv("FLASK_ENV", "development")
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key")
    MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    MONGO_DB = os.getenv("MONGO_DB", "hole_in_the_wall")
    # Allow multiple origins (e.g., localhost vs 127.0.0.1) to prevent CORS issues in dev.
    # Example:
    # FRONTEND_ORIGINS=http://localhost:8080,http://127.0.0.1:8080
    _origins_raw = os.getenv("FRONTEND_ORIGINS", "").strip()
    if _origins_raw:
        FRONTEND_ORIGINS = [o.strip() for o in _origins_raw.split(",") if o.strip()]
    else:
        # Safe local defaults so auth state works on localhost and 127.0.0.1.
        single = os.getenv("FRONTEND_ORIGIN", "http://localhost:8080").strip()
        FRONTEND_ORIGINS = [single, "http://localhost:8080", "http://127.0.0.1:8080"]

    # Flask cookie-session settings (dev-friendly defaults).
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
    SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"

    # Avoid slow/fragile Mongo startup behavior during unit tests.
    MONGO_CREATE_INDEXES = os.getenv("MONGO_CREATE_INDEXES", "false").lower() == "true"

    # Atlas TLS on some hosts (e.g. Render): if handshake still fails after certifi, try "true"
    # only after reviewing https://www.mongodb.com/docs/drivers/python/pymongo/ (OCSP tradeoffs).
    MONGO_TLS_DISABLE_OCSP = os.getenv("MONGO_TLS_DISABLE_OCSP", "false").lower() == "true"

    # SMTP email delivery (used for verification/onboarding codes).
    SMTP_HOST = os.getenv("SMTP_HOST", "")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USERNAME = os.getenv("SMTP_USERNAME", "")
    # App passwords are often provided with spaces; strip them.
    SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").replace(" ", "")
    SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "")
    SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
    SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "false").lower() == "true"
    SMTP_TLS_MIN_VERSION = os.getenv("SMTP_TLS_MIN_VERSION", "TLSv1.2")

    EMAIL_CODE_EXPIRES_MINUTES = int(os.getenv("EMAIL_CODE_EXPIRES_MINUTES", "10"))
    STUDENT_VERIFY_BYPASS = os.getenv("STUDENT_VERIFY_BYPASS", "false").lower() == "true"

    # Admin approval for business inquiries.
    ADMIN_API_KEY = os.getenv("ADMIN_API_KEY", "")

    # Address autocomplete (server-side). Prefer Mapbox for production-quality matching.
    MAPBOX_ACCESS_TOKEN = os.getenv("MAPBOX_ACCESS_TOKEN", "").strip()
    # Required by Nominatim when Mapbox is unset; identify your app per OSM policy.
    NOMINATIM_USER_AGENT = os.getenv(
        "NOMINATIM_USER_AGENT",
        "HoleInTheWall/1.0 (campus demo; contact configured in env)",
    ).strip()

    # HTTP email provider (Resend). Use this on hosts that block raw SMTP (e.g. Render).
    # When set, emailer.py will use Resend's HTTPS API instead of smtplib.
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
    # The verified "From" address Resend will send as. Use Resend's sandbox sender
    # (onboarding@resend.dev) for testing or a verified domain for production.
    EMAIL_FROM = os.getenv("EMAIL_FROM", "").strip()
    # Optional: sets a Reply-To header so users can reply directly to your real inbox.
    EMAIL_REPLY_TO = os.getenv("EMAIL_REPLY_TO", "").strip()

    # Cloudinary image hosting. The cloudinary SDK reads CLOUDINARY_URL from env automatically.
    CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "").strip()
    CLOUDINARY_UPLOAD_FOLDER = os.getenv("CLOUDINARY_UPLOAD_FOLDER", "hole-in-the-wall").strip()
    # Hard cap on file size so uploads don't exhaust memory or quota.
    UPLOAD_MAX_BYTES = int(os.getenv("UPLOAD_MAX_BYTES", str(5 * 1024 * 1024)))  # 5 MB
