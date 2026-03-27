import ssl
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from config import Config


def _require_smtp_config():
    if not Config.SMTP_HOST:
        raise RuntimeError("SMTP not configured (SMTP_HOST missing).")
    if not Config.SMTP_USERNAME or not Config.SMTP_PASSWORD:
        raise RuntimeError("SMTP not configured (username/password missing).")
    if not Config.SMTP_FROM_EMAIL:
        raise RuntimeError("SMTP not configured (SMTP_FROM_EMAIL missing).")


def send_email(to_email: str, subject: str, body_text: str):
    """
    Send a plain-text email via SMTP.
    Used for verification codes and onboarding notifications.
    """
    _require_smtp_config()

    msg = MIMEMultipart()
    msg["From"] = Config.SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body_text, "plain", "utf-8"))

    if Config.SMTP_USE_SSL:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(Config.SMTP_HOST, Config.SMTP_PORT, context=context) as server:
            server.ehlo()
            server.login(Config.SMTP_USERNAME, Config.SMTP_PASSWORD)
            server.sendmail(Config.SMTP_FROM_EMAIL, [to_email], msg.as_string())
        return

    # Default to STARTTLS (Gmail typically uses SMTP 587 + STARTTLS).
    with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=10) as server:
        server.ehlo()
        if Config.SMTP_USE_TLS:
            context = ssl.create_default_context()
            # Gmail requires modern TLS; enforce TLSv1.2+ in case a local interceptor downgrades.
            min_ver = (Config.SMTP_TLS_MIN_VERSION or "").upper()
            if min_ver in {"TLSV1.2", "TLS1.2", "TLSV1_2"}:
                context.minimum_version = ssl.TLSVersion.TLSv1_2
            elif min_ver in {"TLSV1.3", "TLS1.3", "TLSV1_3"}:
                context.minimum_version = ssl.TLSVersion.TLSv1_3
            server.starttls(context=context)
            server.ehlo()
        server.login(Config.SMTP_USERNAME, Config.SMTP_PASSWORD)
        server.sendmail(Config.SMTP_FROM_EMAIL, [to_email], msg.as_string())

