"""Sperrliste fuer unerwuenschte Anrufer.

Eingehende Anrufe einer gesperrten Nummer werden nicht zugestellt, sondern auf
ein festes Ziel umgeleitet (Standard: 0123456789). Die Auswertung passiert im
Dialplan-Kontext [blocklist-check], der bei jeder Aenderung neu erzeugt wird.
"""
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator
from sqlalchemy.orm import Session

from auth import require_admin
from audit import log_action
from database import get_db, BlockedCaller, SystemSettings, User

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Blocklist"])

DEFAULT_DESTINATION = "0123456789"
DESTINATION_KEY = "blocklist_destination"
ANONYMOUS_KEY = "block_anonymous_callers"


def _default_destination(db: Session) -> str:
    setting = db.query(SystemSettings).filter(SystemSettings.key == DESTINATION_KEY).first()
    value = (setting.value or "").strip() if setting else ""
    return value or DEFAULT_DESTINATION


def _clean_number(value: str) -> str:
    """Leerzeichen, Klammern und Bindestriche entfernen - die Nummer muss exakt
    so aussehen wie die Absenderkennung im Anruf, sonst greift die Sperre nie."""
    return "".join(ch for ch in (value or "") if ch.isdigit() or ch == "+")


class BlockedCallerCreate(BaseModel):
    number: str
    destination: Optional[str] = None
    description: Optional[str] = None

    @field_validator("number")
    @classmethod
    def number_not_empty(cls, v: str) -> str:
        if not _clean_number(v):
            raise ValueError("Rufnummer fehlt oder enthaelt keine Ziffern")
        return v


class BlockedCallerResponse(BaseModel):
    id: int
    number: str
    destination: str
    description: Optional[str] = None
    enabled: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DestinationUpdate(BaseModel):
    destination: str


class AnonymousUpdate(BaseModel):
    block_anonymous: bool


def regenerate(db: Session):
    """Dialplan neu schreiben und laden - identisch zum Ablauf bei Umleitungen."""
    from database import InboundRoute, CallForward, VoicemailMailbox, SIPPeer, SIPTrunk, RingGroup, IVRMenu
    from dialplan import write_extensions_config, reload_dialplan
    try:
        write_extensions_config(
            db.query(InboundRoute).filter(InboundRoute.enabled == True).all(),
            db.query(CallForward).filter(CallForward.enabled == True).all(),
            db.query(VoicemailMailbox).all(),
            db.query(SIPPeer).all(),
            db.query(SIPTrunk).all(),
            db.query(RingGroup).all(),
            db.query(IVRMenu).all(),
            db.query(BlockedCaller).all(),
        )
        reload_dialplan()
    except Exception as e:
        logger.error(f"Failed to regenerate dialplan after blocklist change: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[BlockedCallerResponse])
def list_blocked(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return db.query(BlockedCaller).order_by(BlockedCaller.created_at.desc()).all()


@router.get("/destination")
def get_destination(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return {"destination": _default_destination(db)}


@router.put("/destination")
def set_destination(data: DestinationUpdate, request: Request,
                    db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    dest = _clean_number(data.destination)
    if not dest:
        raise HTTPException(status_code=400, detail="Zielrufnummer fehlt oder enthaelt keine Ziffern")
    setting = db.query(SystemSettings).filter(SystemSettings.key == DESTINATION_KEY).first()
    if setting:
        setting.value = dest
    else:
        db.add(SystemSettings(key=DESTINATION_KEY, value=dest,
                              description="Ziel, auf das gesperrte Anrufer umgeleitet werden"))
    db.commit()
    log_action(db, current_user.username, "blocklist_destination_updated", "blocklist", dest,
               None, request.client.host if request.client else None)
    return {"status": "ok", "destination": dest}


@router.get("/anonymous")
def get_anonymous(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    setting = db.query(SystemSettings).filter(SystemSettings.key == ANONYMOUS_KEY).first()
    enabled = bool(setting and str(setting.value).strip().lower() in ("1", "true", "yes", "on"))
    return {"block_anonymous": enabled}


@router.put("/anonymous")
def set_anonymous(data: AnonymousUpdate, request: Request,
                  db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    value = "true" if data.block_anonymous else "false"
    setting = db.query(SystemSettings).filter(SystemSettings.key == ANONYMOUS_KEY).first()
    if setting:
        setting.value = value
    else:
        db.add(SystemSettings(key=ANONYMOUS_KEY, value=value,
                              description="Anrufer mit unterdrueckter Rufnummer umleiten"))
    db.commit()
    regenerate(db)
    log_action(db, current_user.username,
               "anonymous_block_enabled" if data.block_anonymous else "anonymous_block_disabled",
               "blocklist", "anonymous", None, request.client.host if request.client else None)
    return {"status": "ok", "block_anonymous": data.block_anonymous}


@router.post("/", response_model=BlockedCallerResponse)
def block_caller(data: BlockedCallerCreate, request: Request,
                 db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    number = _clean_number(data.number)
    existing = db.query(BlockedCaller).filter(BlockedCaller.number == number).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"{number} ist bereits gesperrt")

    destination = _clean_number(data.destination or "") or _default_destination(db)
    if destination == number:
        raise HTTPException(status_code=400,
                            detail="Ziel und gesperrte Nummer sind identisch - das ergaebe eine Schleife")

    entry = BlockedCaller(number=number, destination=destination,
                          description=data.description, enabled=True)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    regenerate(db)
    log_action(db, current_user.username, "caller_blocked", "blocklist", number,
               None, request.client.host if request.client else None)
    return entry


@router.put("/{entry_id}/toggle", response_model=BlockedCallerResponse)
def toggle_blocked(entry_id: int, request: Request,
                   db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    entry = db.query(BlockedCaller).filter(BlockedCaller.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
    entry.enabled = not entry.enabled
    db.commit()
    db.refresh(entry)
    regenerate(db)
    log_action(db, current_user.username,
               "caller_block_enabled" if entry.enabled else "caller_block_disabled",
               "blocklist", entry.number, None, request.client.host if request.client else None)
    return entry


@router.delete("/{entry_id}")
def unblock_caller(entry_id: int, request: Request,
                   db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    entry = db.query(BlockedCaller).filter(BlockedCaller.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Eintrag nicht gefunden")
    number = entry.number
    db.delete(entry)
    db.commit()
    regenerate(db)
    log_action(db, current_user.username, "caller_unblocked", "blocklist", number,
               None, request.client.host if request.client else None)
    return {"status": "ok"}
