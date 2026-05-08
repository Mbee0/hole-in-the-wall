"""
Email delivery: Resend HTTPS API (preferred on hosts like Render that block raw SMTP),
with SMTP as a fallback for local development or other environments.

Behavior
- If RESEND_API_KEY is set, use Resend (HTTPS, port 443).
- Otherwise, fall back to smtplib using SMTP_* settings.

Resend setup
- https://resend.com → create API key → set RESEND_API_KEY in env.
- Until you verify a domain, you can only send to addresses you control or
  the email you signed up with. Production: verify a domain in Resend's dashboard.
"""
import json
import smtplib
import ssl
import urllib.error
import urllib.request
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config import Config


class EmailDeliveryError(RuntimeError):
    """Raised when neither Resend nor SMTP can deliver a message."""


def _resend_configured() -> bool:
    return bool(Config.RESEND_API_KEY)


def _resolve_from_address() -> str:
    """Sender to put in the From header."""
    if Config.EMAIL_FROM:
        return Config.EMAIL_FROM
    if Config.SMTP_FROM_EMAIL:
        return Config.SMTP_FROM_EMAIL
    raise EmailDeliveryError(
        "No sender configured. Set EMAIL_FROM (Resend) or SMTP_FROM_EMAIL (SMTP)."
    )


def _send_via_resend(to_email: str, subject: str, body_text: str) -> None:
    """POST to https://api.resend.com/emails. Uses HTTPS, so it works on hosts that block SMTP."""
    payload = {
        "from": _resolve_from_address(),
        "to": [to_email],
        "subject": subject,
        "text": body_text,
    }
    if Config.EMAIL_REPLY_TO:
        payload["reply_to"] = Config.EMAIL_REPLY_TO

    body_bytes = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=body_bytes,
        method="POST",
        headers={
            "Authorization": f"Bearer {Config.RESEND_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
    except urllib.error.HTTPError as exc:
        # Surface API error text so callers can show a useful message.
        try:
            details = exc.read().decode("utf-8", errors="replace")
        except Exception:
            details = ""
        raise EmailDeliveryError(
            f"Resend rejected message ({exc.code}). {details}"
        ) from exc
    except urllib.error.URLError as exc:
        raise EmailDeliveryError(f"Could not reach Resend API: {exc.reason}") from exc


def _require_smtp_config() -> None:
    if not Config.SMTP_HOST:
        raise EmailDeliveryError("SMTP not configured (SMTP_HOST missing).")
    if not Config.SMTP_USERNAME or not Config.SMTP_PASSWORD:
        raise EmailDeliveryError("SMTP not configured (username/password missing).")
    if not Config.SMTP_FROM_EMAIL:
        raise EmailDeliveryError("SMTP not configured (SMTP_FROM_EMAIL missing).")


def _send_via_smtp(to_email: str, subject: str, body_text: str) -> None:
    _require_smtp_config()

    msg = MIMEMultipart()
    msg["From"] = Config.SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    if Config.EMAIL_REPLY_TO:
        msg["Reply-To"] = Config.EMAIL_REPLY_TO
    msg.attach(MIMEText(body_text, "plain", "utf-8"))

    if Config.SMTP_USE_SSL:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(Config.SMTP_HOST, Config.SMTP_PORT, context=context) as server:
            server.ehlo()
            server.login(Config.SMTP_USERNAME, Config.SMTP_PASSWORD)
            server.sendmail(Config.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        return

    with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=10) as server:
        server.ehlo()
        if Config.SMTP_USE_TLS:
            context = ssl.create_default_context()
            # Gmail requires modern TLS; enforce TLSv1.2+ if a local interceptor downgrades.
            min_ver = (Config.SMTP_TLS_MIN_VERSION or "").upper()
            if min_ver in {"TLSV1.2", "TLS1.2", "TLSV1_2"}:
                context.minimum_version = ssl.TLSVersion.TLSv1_2
            elif min_ver in {"TLSV1.3", "TLS1.3", "TLSV1_3"}:
                context.minimum_version = ssl.TLSVersion.TLSv1_3
            server.starttls(context=context)
            server.ehlo()
        server.login(Config.SMTP_USERNAME, Config.SMTP_PASSWORD)
        server.sendmail(Config.SMTP_FROM_EMAIL, [to_email], msg.as_string())


def send_email(to_email: str, subject: str, body_text: str) -> None:
    """
    Send a plain-text email.
    Resend (HTTPS) preferred when RESEND_API_KEY is set; otherwise falls back to SMTP.
    """
    if _resend_configured():
        _send_via_resend(to_email, subject, body_text)
        return
    _send_via_smtp(to_email, subject, body_text)
