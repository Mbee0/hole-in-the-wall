"""
Image uploads via Cloudinary.

Frontend posts a multipart/form-data request with a `file` field; the server forwards
the binary to Cloudinary and returns a CDN URL the frontend can store on the deal/business
document.

Configuration: set CLOUDINARY_URL in env (the official SDK reads it automatically).
"""
from flask import Blueprint, jsonify, request

from config import Config
from services.authz import account_type_required

bp = Blueprint("uploads", __name__, url_prefix="/api/uploads")

# Match common image formats students will paste in.
_ALLOWED_MIMES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
_ALLOWED_EXT = {"png", "jpg", "jpeg", "webp"}


def _ext_from_filename(name: str) -> str:
    if not name or "." not in name:
        return ""
    return name.rsplit(".", 1)[-1].lower()


@bp.post("/image")
@account_type_required("business")
def upload_image(user):
    if not Config.CLOUDINARY_URL:
        return jsonify({"error": "Image uploads are not configured on the server."}), 503

    if "file" not in request.files:
        return jsonify({"error": "No file provided. Send multipart/form-data with a 'file' field."}), 400

    file_storage = request.files["file"]
    if not file_storage or file_storage.filename == "":
        return jsonify({"error": "No file selected."}), 400

    mime = (file_storage.mimetype or "").lower()
    ext = _ext_from_filename(file_storage.filename or "")
    if mime not in _ALLOWED_MIMES and ext not in _ALLOWED_EXT:
        return jsonify({"error": "Only PNG, JPG, JPEG, or WebP images are accepted."}), 400

    # Enforce size: read into memory once, but bail early if oversized.
    raw = file_storage.read()
    if len(raw) == 0:
        return jsonify({"error": "Uploaded file is empty."}), 400
    if len(raw) > Config.UPLOAD_MAX_BYTES:
        max_mb = Config.UPLOAD_MAX_BYTES / (1024 * 1024)
        return jsonify({"error": f"File too large. Limit is {max_mb:.0f} MB."}), 413

    try:
        # Lazy import keeps the rest of the app working in test environments without cloudinary.
        import cloudinary  # type: ignore[import-not-found]
        import cloudinary.uploader  # type: ignore[import-not-found]
    except ImportError:
        return jsonify({"error": "cloudinary library not installed on the server."}), 503

    # The SDK auto-loads CLOUDINARY_URL on import, but configure() handles late-bound env too.
    cloudinary.config(cloudinary_url=Config.CLOUDINARY_URL, secure=True)

    folder = Config.CLOUDINARY_UPLOAD_FOLDER or "hole-in-the-wall"
    purpose = (request.form.get("purpose") or "").strip().lower()
    sub = "deals" if purpose == "deal" else "gallery" if purpose == "gallery" else "misc"

    try:
        result = cloudinary.uploader.upload(
            raw,
            folder=f"{folder}/{sub}",
            resource_type="image",
            allowed_formats=list(_ALLOWED_EXT),
            # auto-rotate from EXIF, strip metadata to reduce size, deliver in best format.
            transformation=[
                {"quality": "auto:good"},
                {"fetch_format": "auto"},
            ],
            tags=[f"owner:{str(user['_id'])}", f"purpose:{sub}"],
        )
    except Exception as exc:
        return jsonify({"error": f"Upload failed: {exc}"}), 502

    secure_url = result.get("secure_url") or result.get("url")
    if not secure_url:
        return jsonify({"error": "Cloudinary did not return an image URL."}), 502

    return jsonify(
        {
            "url": secure_url,
            "public_id": result.get("public_id"),
            "width": result.get("width"),
            "height": result.get("height"),
            "format": result.get("format"),
            "bytes": result.get("bytes"),
        }
    ), 201
