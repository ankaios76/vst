"""
IVR API Router
CRUD operations for IVR menus
"""
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, Field
from datetime import datetime
import logging
import re
import os

from database import get_db, IVRMenu, IVROption, SIPPeer, RingGroup, User, InboundRoute, CallForward, VoicemailMailbox, SIPTrunk
from auth import get_current_user
from dialplan import write_extensions_config, reload_dialplan
from queue_config import write_queues_config, reload_queues
from audit import log_action

logger = logging.getLogger(__name__)

router = APIRouter()

DIGIT_RE = re.compile(r'^[0-9*#]$')
PROMPT_DIR = "/app/uploads/ivr"
ALLOWED_EXT = {".wav", ".gsm", ".ulaw", ".alaw", ".mp3", ".ogg", ".flac"}
MAX_SIZE_BYTES = 10 * 1024 * 1024
MAX_DURATION_SECONDS = 30


class IVROptionIn(BaseModel):
    digit: str
    destination: str


class IVRMenuBase(BaseModel):
    name: str
    extension: str
    prompt: str | None = None
    timeout_seconds: int = 5
    timeout_destination: str | None = None
    retries: int = 2
    inbound_trunk_id: int | None = None
    inbound_did: str | None = None
    enabled: bool = True
    options: List[IVROptionIn] = Field(default_factory=list)


class IVRMenuCreate(IVRMenuBase):
    pass


class IVRMenuUpdate(IVRMenuBase):
    pass


class IVRMenuResponse(IVRMenuBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def _validate_digits(options: List[IVROptionIn]):
    seen = set()
    for opt in options:
        if not DIGIT_RE.match(opt.digit):
            raise HTTPException(status_code=400, detail="Ungültige Taste. Erlaubt: 0-9, *, #")
        if opt.digit in seen:
            raise HTTPException(status_code=400, detail=f"Doppelte Taste: {opt.digit}")
        seen.add(opt.digit)


def _validate_destination(db: Session, dest: str | None):
    if not dest:
        return
    peer = db.query(SIPPeer).filter(SIPPeer.extension == dest).first()
    group = db.query(RingGroup).filter(RingGroup.extension == dest).first()
    ivr = db.query(IVRMenu).filter(IVRMenu.extension == dest).first()
    if not peer and not group and not ivr:
        raise HTTPException(status_code=400, detail=f"Ziel {dest} nicht gefunden")


def _validate_inbound_did(db: Session, trunk_id: int | None, did: str | None, current_extension: str | None = None):
    if not did:
        return
    if not trunk_id:
        raise HTTPException(status_code=400, detail="Leitung muss ausgewählt werden")
    trunk = db.query(SIPTrunk).filter(SIPTrunk.id == trunk_id).first()
    if not trunk:
        raise HTTPException(status_code=400, detail="Leitung nicht gefunden")
    existing = db.query(InboundRoute).filter(InboundRoute.did == did).first()
    if existing and existing.destination_extension != (current_extension or ""):
        raise HTTPException(status_code=400, detail="Rufnummer ist bereits vergeben")


def _sync_inbound_route(db: Session, menu: IVRMenu, trunk_id: int | None, did: str | None):
    if not did or not trunk_id:
        if menu.inbound_did:
            existing = db.query(InboundRoute).filter(
                InboundRoute.did == menu.inbound_did,
                InboundRoute.destination_extension == menu.extension,
            ).first()
            if existing:
                db.delete(existing)
                db.commit()
        return

    existing = db.query(InboundRoute).filter(InboundRoute.did == did).first()
    if existing:
        if existing.destination_extension == menu.extension:
            existing.trunk_id = trunk_id
            existing.description = f"IVR: {menu.name}"
            db.commit()
            return
        raise HTTPException(status_code=400, detail="Rufnummer ist bereits vergeben")

    new_route = InboundRoute(
        did=did,
        trunk_id=trunk_id,
        destination_extension=menu.extension,
        description=f"IVR: {menu.name}",
        enabled=True,
    )
    db.add(new_route)
    db.commit()


def _regenerate_all(db: Session):
    all_routes = db.query(InboundRoute).all()
    all_forwards = db.query(CallForward).all()
    all_mailboxes = db.query(VoicemailMailbox).all()
    all_peers = db.query(SIPPeer).all()
    all_trunks = db.query(SIPTrunk).all()
    all_groups = db.query(RingGroup).all()
    all_ivr = db.query(IVRMenu).all()

    write_extensions_config(all_routes, all_forwards, all_mailboxes, all_peers, all_trunks, all_groups, all_ivr)
    reload_dialplan()
    write_queues_config(all_groups)
    reload_queues()


def _to_response(menu: IVRMenu) -> dict:
    options = sorted(menu.options, key=lambda o: o.position)
    return {
        "id": menu.id,
        "name": menu.name,
        "extension": menu.extension,
        "prompt": menu.prompt,
        "timeout_seconds": menu.timeout_seconds,
        "timeout_destination": menu.timeout_destination,
        "retries": menu.retries,
        "inbound_trunk_id": menu.inbound_trunk_id,
        "inbound_did": menu.inbound_did,
        "enabled": menu.enabled,
        "options": [{"digit": o.digit, "destination": o.destination} for o in options],
        "created_at": menu.created_at,
        "updated_at": menu.updated_at,
    }


@router.get("/", response_model=List[IVRMenuResponse])
def list_menus(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    menus = db.query(IVRMenu).all()
    return [_to_response(m) for m in menus]


@router.post("/", response_model=IVRMenuResponse)
def create_menu(menu: IVRMenuCreate, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if db.query(IVRMenu).filter(IVRMenu.name == menu.name).first():
        raise HTTPException(status_code=400, detail="IVR-Name existiert bereits")
    if db.query(IVRMenu).filter(IVRMenu.extension == menu.extension).first():
        raise HTTPException(status_code=400, detail="IVR-Nummer existiert bereits")
    if db.query(SIPPeer).filter(SIPPeer.extension == menu.extension).first():
        raise HTTPException(status_code=400, detail="IVR-Nummer ist bereits als Nebenstelle vergeben")
    if db.query(RingGroup).filter(RingGroup.extension == menu.extension).first():
        raise HTTPException(status_code=400, detail="IVR-Nummer ist bereits als Gruppe vergeben")

    if menu.timeout_seconds < 2 or menu.timeout_seconds > 30:
        raise HTTPException(status_code=400, detail="Timeout muss zwischen 2 und 30 Sekunden liegen")
    if menu.retries < 0 or menu.retries > 5:
        raise HTTPException(status_code=400, detail="Wiederholungen müssen zwischen 0 und 5 liegen")

    _validate_digits(menu.options)
    for opt in menu.options:
        _validate_destination(db, opt.destination)
    _validate_destination(db, menu.timeout_destination)
    _validate_inbound_did(db, menu.inbound_trunk_id, menu.inbound_did)

    db_menu = IVRMenu(
        name=menu.name,
        extension=menu.extension,
        prompt=menu.prompt,
        timeout_seconds=menu.timeout_seconds,
        timeout_destination=menu.timeout_destination,
        retries=menu.retries,
        inbound_trunk_id=menu.inbound_trunk_id,
        inbound_did=menu.inbound_did,
        enabled=menu.enabled,
    )
    db.add(db_menu)
    db.commit()
    db.refresh(db_menu)

    for idx, opt in enumerate(menu.options):
        db.add(IVROption(menu_id=db_menu.id, digit=opt.digit, destination=opt.destination, position=idx))
    db.commit()
    db.refresh(db_menu)

    _sync_inbound_route(db, db_menu, menu.inbound_trunk_id, menu.inbound_did)

    log_action(db, current_user.username, "ivr_created", "ivr", db_menu.name,
               {"extension": db_menu.extension}, request.client.host if request.client else None)

    _regenerate_all(db)

    return _to_response(db_menu)


@router.put("/{menu_id}", response_model=IVRMenuResponse)
def update_menu(menu_id: int, menu: IVRMenuUpdate, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_menu = db.query(IVRMenu).filter(IVRMenu.id == menu_id).first()
    if not db_menu:
        raise HTTPException(status_code=404, detail="IVR nicht gefunden")

    if menu.name != db_menu.name:
        if db.query(IVRMenu).filter(IVRMenu.name == menu.name).first():
            raise HTTPException(status_code=400, detail="IVR-Name existiert bereits")

    if menu.extension != db_menu.extension:
        if db.query(IVRMenu).filter(IVRMenu.extension == menu.extension).first():
            raise HTTPException(status_code=400, detail="IVR-Nummer existiert bereits")
        if db.query(SIPPeer).filter(SIPPeer.extension == menu.extension).first():
            raise HTTPException(status_code=400, detail="IVR-Nummer ist bereits als Nebenstelle vergeben")
        if db.query(RingGroup).filter(RingGroup.extension == menu.extension).first():
            raise HTTPException(status_code=400, detail="IVR-Nummer ist bereits als Gruppe vergeben")

    if menu.timeout_seconds < 2 or menu.timeout_seconds > 30:
        raise HTTPException(status_code=400, detail="Timeout muss zwischen 2 und 30 Sekunden liegen")
    if menu.retries < 0 or menu.retries > 5:
        raise HTTPException(status_code=400, detail="Wiederholungen müssen zwischen 0 und 5 liegen")

    _validate_digits(menu.options)
    for opt in menu.options:
        _validate_destination(db, opt.destination)
    _validate_destination(db, menu.timeout_destination)
    _validate_inbound_did(db, menu.inbound_trunk_id, menu.inbound_did, current_extension=db_menu.extension)

    old_extension = db_menu.extension
    old_inbound_did = db_menu.inbound_did
    old_inbound_trunk = db_menu.inbound_trunk_id

    db_menu.name = menu.name
    db_menu.extension = menu.extension
    db_menu.prompt = menu.prompt
    db_menu.timeout_seconds = menu.timeout_seconds
    db_menu.timeout_destination = menu.timeout_destination
    db_menu.retries = menu.retries
    db_menu.inbound_trunk_id = menu.inbound_trunk_id
    db_menu.inbound_did = menu.inbound_did
    db_menu.enabled = menu.enabled
    db_menu.updated_at = datetime.utcnow()

    db.query(IVROption).filter(IVROption.menu_id == db_menu.id).delete()
    for idx, opt in enumerate(menu.options):
        db.add(IVROption(menu_id=db_menu.id, digit=opt.digit, destination=opt.destination, position=idx))

    db.commit()
    db.refresh(db_menu)

    # Update inbound routes pointing to old extension if needed
    if old_extension != db_menu.extension:
        routes = db.query(InboundRoute).filter(InboundRoute.destination_extension == old_extension).all()
        for r in routes:
            r.destination_extension = db_menu.extension
        db.commit()
    if old_inbound_did != db_menu.inbound_did or old_inbound_trunk != db_menu.inbound_trunk_id:
        if old_inbound_did:
            old_route = db.query(InboundRoute).filter(
                InboundRoute.did == old_inbound_did,
                InboundRoute.destination_extension == old_extension,
            ).first()
            if old_route:
                db.delete(old_route)
                db.commit()
        _sync_inbound_route(db, db_menu, db_menu.inbound_trunk_id, db_menu.inbound_did)

    log_action(db, current_user.username, "ivr_updated", "ivr", db_menu.name,
               {"extension": db_menu.extension}, request.client.host if request.client else None)

    _regenerate_all(db)

    return _to_response(db_menu)


@router.delete("/{menu_id}")
def delete_menu(menu_id: int, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_menu = db.query(IVRMenu).filter(IVRMenu.id == menu_id).first()
    if not db_menu:
        raise HTTPException(status_code=404, detail="IVR nicht gefunden")

    name = db_menu.name
    if db_menu.inbound_did:
        route = db.query(InboundRoute).filter(
            InboundRoute.did == db_menu.inbound_did,
            InboundRoute.destination_extension == db_menu.extension,
        ).first()
        if route:
            db.delete(route)
            db.commit()
    db.query(IVROption).filter(IVROption.menu_id == menu_id).delete()
    db.delete(db_menu)
    db.commit()

    log_action(db, current_user.username, "ivr_deleted", "ivr", name, {}, request.client.host if request.client else None)

    _regenerate_all(db)

    return {"status": "ok"}


@router.get("/prompts")
def list_prompts(current_user: User = Depends(get_current_user)):
    """List available uploaded IVR prompts (without extension)."""
    try:
        if not os.path.isdir(PROMPT_DIR):
            return []
        files = []
        for name in os.listdir(PROMPT_DIR):
            base, ext = os.path.splitext(name)
            if ext.lower() == ".wav":
                files.append(f"custom/{base}")
        files = sorted(set(files))
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_prompt(file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    """Upload an IVR prompt and copy into Asterisk sounds/custom."""
    try:
        os.makedirs(PROMPT_DIR, exist_ok=True)
        filename = os.path.basename(file.filename or "")
        base, ext = os.path.splitext(filename)
        if not base or ext.lower() not in ALLOWED_EXT:
            raise HTTPException(status_code=400, detail="Ungültiges Dateiformat")

        content = await file.read()
        if len(content) > MAX_SIZE_BYTES:
            raise HTTPException(status_code=400, detail="Datei ist zu groß (max. 10 MB)")

        safe_base = re.sub(r'[^a-zA-Z0-9_.-]+', '_', base)
        input_path = os.path.join(PROMPT_DIR, f"{safe_base}{ext.lower()}")
        output_path = os.path.join(PROMPT_DIR, f"{safe_base}.wav")
        with open(input_path, "wb") as f:
            f.write(content)

        # Convert to 8kHz mono WAV for Asterisk
        import subprocess
        conv = subprocess.run(
            ["ffmpeg", "-y", "-i", input_path, "-ar", "8000", "-ac", "1", "-c:a", "pcm_s16le", output_path],
            capture_output=True,
        )
        if conv.returncode != 0:
            raise HTTPException(status_code=500, detail="Audio-Konvertierung fehlgeschlagen")

        # Validate duration
        probe = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", output_path],
            capture_output=True,
            text=True,
        )
        if probe.returncode != 0:
            raise HTTPException(status_code=500, detail="Audio-Analyse fehlgeschlagen")
        try:
            duration = float(probe.stdout.strip())
        except Exception:
            duration = 0.0
        if duration > MAX_DURATION_SECONDS:
            raise HTTPException(status_code=400, detail="Audio ist zu lang (max. 30 Sekunden)")

        # Copy into Asterisk container
        subprocess.run(['docker', 'exec', 'pbx_asterisk', 'sh', '-c', 'mkdir -p /var/lib/asterisk/sounds/custom'], check=False)
        with open(output_path, "rb") as f:
            wav_bytes = f.read()
        proc = subprocess.run(
            ['docker', 'exec', '-i', 'pbx_asterisk', 'sh', '-c', f'cat > /var/lib/asterisk/sounds/custom/{safe_base}.wav'],
            input=wav_bytes,
            capture_output=True,
        )
        if proc.returncode != 0:
            raise HTTPException(status_code=500, detail="Konnte Audio nicht in Asterisk kopieren")

        return JSONResponse({"prompt": f"custom/{safe_base}"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
