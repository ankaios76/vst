"""
Ring Groups API Router
CRUD operations for ring group (queue) management
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, Field
from datetime import datetime
import logging

from database import get_db, RingGroup, RingGroupMember, SIPPeer, IVRMenu, User, InboundRoute, CallForward, VoicemailMailbox, SIPTrunk
from auth import get_current_user
from dialplan import write_extensions_config, reload_dialplan
from queue_config import write_queues_config, reload_queues
from audit import log_action

logger = logging.getLogger(__name__)

router = APIRouter()


ALLOWED_STRATEGIES = {"ringall", "roundrobin", "leastrecent"}


class RingGroupBase(BaseModel):
    name: str
    extension: str
    inbound_trunk_id: int | None = None
    inbound_did: str | None = None
    strategy: str = "ringall"
    ring_time: int = 20
    enabled: bool = True
    members: List[str] = Field(default_factory=list)


class RingGroupCreate(RingGroupBase):
    pass


class RingGroupUpdate(RingGroupBase):
    pass


class RingGroupResponse(RingGroupBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def _validate_strategy(strategy: str):
    if strategy not in ALLOWED_STRATEGIES:
        raise HTTPException(status_code=400, detail="Ungültige Strategie")


def _validate_members(db: Session, members: List[str]):
    if not members:
        return
    peers = db.query(SIPPeer).filter(SIPPeer.extension.in_(members)).all()
    found = {p.extension for p in peers}
    missing = [m for m in members if m not in found]
    if missing:
        raise HTTPException(status_code=400, detail=f"Unbekannte Nebenstellen: {', '.join(missing)}")


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


def _sync_inbound_route(db: Session, group: RingGroup, trunk_id: int | None, did: str | None):
    # Remove existing route for this group if no DID is set
    if not did or not trunk_id:
        if group.inbound_did:
            existing = db.query(InboundRoute).filter(
                InboundRoute.did == group.inbound_did,
                InboundRoute.destination_extension == group.extension,
            ).first()
            if existing:
                db.delete(existing)
                db.commit()
        return

    # Check if there is already a route for this DID
    existing = db.query(InboundRoute).filter(InboundRoute.did == did).first()
    if existing:
        # If it's already pointing to this group, update metadata
        if existing.destination_extension == group.extension:
            existing.trunk_id = trunk_id
            existing.description = f"Sammelruf: {group.name}"
            db.commit()
            return
        raise HTTPException(status_code=400, detail="Rufnummer ist bereits vergeben")

    # Create new route
    new_route = InboundRoute(
        did=did,
        trunk_id=trunk_id,
        destination_extension=group.extension,
        description=f"Sammelruf: {group.name}",
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


def _to_response(group: RingGroup) -> dict:
    members = sorted(group.members, key=lambda m: m.position)
    return {
        "id": group.id,
        "name": group.name,
        "extension": group.extension,
        "inbound_trunk_id": group.inbound_trunk_id,
        "inbound_did": group.inbound_did,
        "strategy": group.strategy,
        "ring_time": group.ring_time,
        "enabled": group.enabled,
        "members": [m.extension for m in members],
        "created_at": group.created_at,
        "updated_at": group.updated_at,
    }


@router.get("/", response_model=List[RingGroupResponse])
def list_groups(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    groups = db.query(RingGroup).all()
    return [_to_response(g) for g in groups]


@router.post("/", response_model=RingGroupResponse)
def create_group(group: RingGroupCreate, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if db.query(RingGroup).filter(RingGroup.name == group.name).first():
        raise HTTPException(status_code=400, detail="Gruppenname existiert bereits")
    if db.query(RingGroup).filter(RingGroup.extension == group.extension).first():
        raise HTTPException(status_code=400, detail="Gruppen-Nummer existiert bereits")
    if db.query(SIPPeer).filter(SIPPeer.extension == group.extension).first():
        raise HTTPException(status_code=400, detail="Gruppen-Nummer ist bereits als Nebenstelle vergeben")

    _validate_strategy(group.strategy)
    if group.ring_time < 5 or group.ring_time > 120:
        raise HTTPException(status_code=400, detail="Klingelzeit muss zwischen 5 und 120 Sekunden liegen")
    _validate_members(db, group.members)
    _validate_inbound_did(db, group.inbound_trunk_id, group.inbound_did, current_extension=None)

    db_group = RingGroup(
        name=group.name,
        extension=group.extension,
        inbound_trunk_id=group.inbound_trunk_id,
        inbound_did=group.inbound_did,
        strategy=group.strategy,
        ring_time=group.ring_time,
        enabled=group.enabled,
    )
    db.add(db_group)
    db.commit()
    db.refresh(db_group)

    for idx, ext in enumerate(group.members):
        db_member = RingGroupMember(group_id=db_group.id, extension=ext, position=idx)
        db.add(db_member)
    db.commit()
    db.refresh(db_group)

    # Create inbound route if configured
    _sync_inbound_route(db, db_group, group.inbound_trunk_id, group.inbound_did)

    log_action(db, current_user.username, "group_created", "ring_group", db_group.name,
               {"extension": db_group.extension}, request.client.host if request.client else None)

    _regenerate_all(db)

    return _to_response(db_group)


@router.put("/{group_id}", response_model=RingGroupResponse)
def update_group(group_id: int, group: RingGroupUpdate, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_group = db.query(RingGroup).filter(RingGroup.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")

    if group.name != db_group.name:
        if db.query(RingGroup).filter(RingGroup.name == group.name).first():
            raise HTTPException(status_code=400, detail="Gruppenname existiert bereits")

    if group.extension != db_group.extension:
        if db.query(RingGroup).filter(RingGroup.extension == group.extension).first():
            raise HTTPException(status_code=400, detail="Gruppen-Nummer existiert bereits")
        if db.query(SIPPeer).filter(SIPPeer.extension == group.extension).first():
            raise HTTPException(status_code=400, detail="Gruppen-Nummer ist bereits als Nebenstelle vergeben")

    _validate_strategy(group.strategy)
    if group.ring_time < 5 or group.ring_time > 120:
        raise HTTPException(status_code=400, detail="Klingelzeit muss zwischen 5 und 120 Sekunden liegen")
    _validate_members(db, group.members)
    _validate_inbound_did(db, group.inbound_trunk_id, group.inbound_did, current_extension=db_group.extension)

    old_extension = db_group.extension
    old_inbound_trunk = db_group.inbound_trunk_id
    old_inbound_did = db_group.inbound_did

    db_group.name = group.name
    db_group.extension = group.extension
    db_group.inbound_trunk_id = group.inbound_trunk_id
    db_group.inbound_did = group.inbound_did
    db_group.strategy = group.strategy
    db_group.ring_time = group.ring_time
    db_group.enabled = group.enabled
    db_group.updated_at = datetime.utcnow()

    # Replace members
    db.query(RingGroupMember).filter(RingGroupMember.group_id == db_group.id).delete()
    for idx, ext in enumerate(group.members):
        db.add(RingGroupMember(group_id=db_group.id, extension=ext, position=idx))

    db.commit()
    db.refresh(db_group)

    # Update inbound route if necessary
    if old_extension != db_group.extension or old_inbound_did != db_group.inbound_did or old_inbound_trunk != db_group.inbound_trunk_id:
        # Remove old route if it pointed to old extension or old DID
        if old_inbound_did:
            old_route = db.query(InboundRoute).filter(
                InboundRoute.did == old_inbound_did,
                InboundRoute.destination_extension == old_extension,
            ).first()
            if old_route:
                db.delete(old_route)
                db.commit()
        _sync_inbound_route(db, db_group, db_group.inbound_trunk_id, db_group.inbound_did)

    log_action(db, current_user.username, "group_updated", "ring_group", db_group.name,
               {"extension": db_group.extension}, request.client.host if request.client else None)

    _regenerate_all(db)

    return _to_response(db_group)


@router.delete("/{group_id}")
def delete_group(group_id: int, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_group = db.query(RingGroup).filter(RingGroup.id == group_id).first()
    if not db_group:
        raise HTTPException(status_code=404, detail="Gruppe nicht gefunden")

    name = db_group.name
    if db_group.inbound_did:
        route = db.query(InboundRoute).filter(
            InboundRoute.did == db_group.inbound_did,
            InboundRoute.destination_extension == db_group.extension,
        ).first()
        if route:
            db.delete(route)
            db.commit()
    db.query(RingGroupMember).filter(RingGroupMember.group_id == group_id).delete()
    db.delete(db_group)
    db.commit()

    log_action(db, current_user.username, "group_deleted", "ring_group", name, {}, request.client.host if request.client else None)

    _regenerate_all(db)

    return {"status": "ok"}
