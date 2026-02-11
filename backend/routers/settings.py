"""
Settings Router - Admin-only system settings management
"""

import json
import ipaddress

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List

from database import get_db, SystemSettings, VoicemailMailbox, SIPPeer, SIPTrunk
from auth import require_admin, User
from email_config import write_msmtp_config, send_test_email
from voicemail_config import write_voicemail_config, reload_voicemail
from pjsip_config import write_pjsip_config, reload_asterisk, DEFAULT_CODECS
from acl_config import write_acl_config, remove_acl_config, reload_acl

router = APIRouter(tags=["Settings"])

SMTP_KEYS = ["smtp_host", "smtp_port", "smtp_tls", "smtp_user", "smtp_password", "smtp_from"]

AVAILABLE_CODECS = [
    {"id": "ulaw", "name": "G.711 u-law", "description": "Standard Nord-Amerika, 64 kbit/s"},
    {"id": "alaw", "name": "G.711 a-law", "description": "Standard Europa, 64 kbit/s"},
    {"id": "g722", "name": "G.722", "description": "HD-Audio, 64 kbit/s"},
    {"id": "opus", "name": "Opus", "description": "Moderner Codec, variabel"},
    {"id": "g729", "name": "G.729", "description": "Niedrige Bandbreite, 8 kbit/s"},
    {"id": "gsm", "name": "GSM", "description": "GSM-Codec, 13 kbit/s"},
]


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


class CodecUpdate(BaseModel):
    global_codecs: str


@router.get("/codecs")
def get_codec_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get global codec settings"""
    setting = db.query(SystemSettings).filter(SystemSettings.key == "global_codecs").first()
    return {
        "global_codecs": setting.value if setting else DEFAULT_CODECS,
        "available_codecs": AVAILABLE_CODECS,
    }


@router.put("/codecs")
def update_codec_settings(
    data: CodecUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Update global codec settings and regenerate pjsip.conf"""
    # Validate codecs
    valid_ids = {c["id"] for c in AVAILABLE_CODECS}
    codecs = [c.strip() for c in data.global_codecs.split(",") if c.strip()]
    if not codecs:
        raise HTTPException(status_code=400, detail="Mindestens ein Codec muss ausgewählt sein")
    for c in codecs:
        if c not in valid_ids:
            raise HTTPException(status_code=400, detail=f"Unbekannter Codec: {c}")

    setting = db.query(SystemSettings).filter(SystemSettings.key == "global_codecs").first()
    if setting:
        setting.value = ",".join(codecs)
    else:
        setting = SystemSettings(key="global_codecs", value=",".join(codecs), description="Global audio codecs")
        db.add(setting)
    db.commit()

    # Regenerate pjsip.conf
    all_peers = db.query(SIPPeer).all()
    all_trunks = db.query(SIPTrunk).all()
    acl_on = _is_acl_enabled(db)
    write_pjsip_config(all_peers, all_trunks, global_codecs=",".join(codecs), acl_enabled=acl_on)
    reload_asterisk()

    return {"status": "ok", "global_codecs": ",".join(codecs)}


# --- IP Whitelist ---

def _is_acl_enabled(db: Session) -> bool:
    """Check if IP whitelist is enabled in DB."""
    s = db.query(SystemSettings).filter(SystemSettings.key == "ip_whitelist_enabled").first()
    return s is not None and s.value == "true"


def _validate_ip_or_cidr(value: str) -> bool:
    """Validate that a string is a valid IP address or CIDR network."""
    try:
        if "/" in value:
            ipaddress.ip_network(value, strict=False)
        else:
            ipaddress.ip_address(value)
        return True
    except ValueError:
        return False


class IpWhitelistUpdate(BaseModel):
    enabled: bool
    ips: List[str]


@router.get("/ip-whitelist")
def get_ip_whitelist(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Get IP whitelist settings."""
    enabled_setting = db.query(SystemSettings).filter(
        SystemSettings.key == "ip_whitelist_enabled"
    ).first()
    ips_setting = db.query(SystemSettings).filter(
        SystemSettings.key == "ip_whitelist"
    ).first()

    enabled = enabled_setting.value == "true" if enabled_setting else False
    ips = json.loads(ips_setting.value) if ips_setting and ips_setting.value else []

    return {"enabled": enabled, "ips": ips}


@router.put("/ip-whitelist")
def update_ip_whitelist(
    data: IpWhitelistUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Save IP whitelist, regenerate acl.conf + pjsip.conf, reload Asterisk."""
    # Validate all IPs/CIDRs
    for ip in data.ips:
        if not _validate_ip_or_cidr(ip.strip()):
            raise HTTPException(status_code=400, detail=f"Ungültige IP-Adresse oder CIDR: {ip}")

    clean_ips = [ip.strip() for ip in data.ips if ip.strip()]

    # Save to DB
    for key, value in [
        ("ip_whitelist_enabled", "true" if data.enabled else "false"),
        ("ip_whitelist", json.dumps(clean_ips)),
    ]:
        setting = db.query(SystemSettings).filter(SystemSettings.key == key).first()
        if setting:
            setting.value = value
        else:
            setting = SystemSettings(key=key, value=value, description="IP whitelist for SIP registration")
            db.add(setting)
    db.commit()

    # Generate/remove ACL config
    if data.enabled and clean_ips:
        write_acl_config(clean_ips)
    else:
        remove_acl_config()
    reload_acl()

    # Regenerate pjsip.conf with or without acl line
    codec_setting = db.query(SystemSettings).filter(SystemSettings.key == "global_codecs").first()
    global_codecs = codec_setting.value if codec_setting else DEFAULT_CODECS
    all_peers = db.query(SIPPeer).all()
    all_trunks = db.query(SIPTrunk).all()
    write_pjsip_config(all_peers, all_trunks, global_codecs=global_codecs, acl_enabled=data.enabled and len(clean_ips) > 0)
    reload_asterisk()

    return {"status": "ok", "enabled": data.enabled, "ips": clean_ips}
