"""
Settings Router - Admin-only system settings management
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db, SystemSettings, VoicemailMailbox
from auth import require_admin, User
from email_config import write_msmtp_config, send_test_email
from voicemail_config import write_voicemail_config, reload_voicemail

router = APIRouter(tags=["Settings"])

SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_tls", "smtp_user", "smtp_password", "smtp_from"]


class SettingsUpdate(BaseModel):
    smtp_host: Optional[str] = ""
    smtp_port: Optional[str] = "587"
    smtp_tls: Optional[str] = "true"
    smtp_user: Optional[str] = ""
    smtp_password: Optional[str] = ""
    smtp_from: Optional[str] = ""


class TestEmailRequest(BaseModel):
    to: str


@router.get("/")
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get all system settings (password masked)"""
    result = {}
    for key in SMTP_KEYS:
        setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        if setting:
            if key == "smtp_password":
                result[key] = "****" if setting.value else ""
            else:
                result[key] = setting.value or ""
        else:
            if key == "smtp_port":
                result[key] = "587"
            elif key == "smtp_tls":
                result[key] = "true"
            else:
                result[key] = ""
    return result


@router.put("/")
def update_settings(
    data: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Save system settings, regenerate msmtp + voicemail config"""
    settings_dict = data.model_dump()

    # If password is masked, keep old value
    if settings_dict.get("smtp_password") == "****":
        existing = db.query(SystemSettings).filter(SystemSettings.key == "smtp_password").first()
        if existing:
            settings_dict["smtp_password"] = existing.value

    for key, value in settings_dict.items():
        setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        if setting:
            setting.value = value or ""
        else:
            setting = SystemSettings(key=key, value=value or "")
            db.add(setting)

    db.commit()

    # Reload full settings from DB for config generation
    full_settings = {}
    for key in SMTP_KEYS:
        s = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        full_settings[key] = s.value if s else ""

    # Write msmtp config into Asterisk container
    if full_settings.get("smtp_host"):
        write_msmtp_config(full_settings)

    # Regenerate voicemail.conf with SMTP settings
    mailboxes = db.query(VoicemailMailbox).all()
    write_voicemail_config(mailboxes, full_settings)
    reload_voicemail()

    return {"status": "ok"}


@router.post("/test-email")
def test_email(
    data: TestEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Send a test email"""
    full_settings = {}
    for key in SMTP_KEYS:
        s = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        full_settings[key] = s.value if s else ""

    if not full_settings.get("smtp_host"):
        raise HTTPException(status_code=400, detail="SMTP ist nicht konfiguriert")

    # Ensure msmtp config is up to date
    write_msmtp_config(full_settings)

    success = send_test_email(full_settings, data.to)
    if not success:
        raise HTTPException(status_code=500, detail="E-Mail konnte nicht gesendet werden. Bitte SMTP-Einstellungen prüfen.")

    return {"status": "ok", "message": f"Test-E-Mail an {data.to} gesendet"}
