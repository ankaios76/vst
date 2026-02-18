"""
SIP Trunks API Router
CRUD operations for SIP trunk management with PJSIP config generation
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from typing import List, Dict, Any
from pydantic import BaseModel
from datetime import datetime, timedelta
import logging

from database import get_db, SIPTrunk, SIPPeer, User, SystemSettings, InboundRoute, CDR
from pjsip_config import write_pjsip_config, reload_asterisk, DEFAULT_CODECS
from auth import get_current_user
from audit import log_action

logger = logging.getLogger(__name__)

router = APIRouter()

# Reference to AMI client (set from main.py)
ami_client = None

def set_ami_client(client):
    global ami_client
    ami_client = client

PROVIDER_SERVERS = {
    "plusnet_basic": "sip.ipfonie.de",
    "plusnet_connect": "sipconnect.ipfonie.de",
    "iliad_it": "voip.iliad.it",
}


def resolve_provider_server(provider: str, auth_mode: str) -> str | None:
    if provider == "telekom_deutschlandlan":
        return "reg.sip-trunk.telekom.de" if auth_mode == "registration" else "stat.sip-trunk.telekom.de"
    if provider == "telekom_allip":
        return "tel.t-online.de"
    return PROVIDER_SERVERS.get(provider)


class SIPTrunkBase(BaseModel):
    name: str
    provider: str
    auth_mode: str = "registration"
    sip_server: str | None = None
    username: str | None = None
    password: str | None = None
    caller_id: str | None = None
    number_block: str | None = None
    context: str = "from-trunk"
    codecs: str = "ulaw,alaw,g722"
    from_user: str | None = None
    enabled: bool = True


class SIPTrunkCreate(SIPTrunkBase):
    pass


class SIPTrunkUpdate(SIPTrunkBase):
    pass


class SIPTrunkResponse(SIPTrunkBase):
    id: int
    sip_server: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


def regenerate_config(db: Session):
    """Regenerate pjsip.conf from database and reload Asterisk"""
    try:
        all_peers = db.query(SIPPeer).all()
        all_trunks = db.query(SIPTrunk).all()
        setting = db.query(SystemSettings).filter(SystemSettings.key == "global_codecs").first()
        global_codecs = setting.value if setting else DEFAULT_CODECS
        acl_setting = db.query(SystemSettings).filter(SystemSettings.key == "ip_whitelist_enabled").first()
        acl_on = acl_setting is not None and acl_setting.value == "true"
        write_pjsip_config(all_peers, all_trunks, global_codecs=global_codecs, acl_enabled=acl_on)
        reload_asterisk()
        logger.info(f"PJSIP config regenerated with {len(all_peers)} peers, {len(all_trunks)} trunks")
    except Exception as e:
        logger.error(f"Failed to regenerate PJSIP config: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", response_model=List[SIPTrunkResponse])
def list_trunks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(SIPTrunk).all()


@router.post("/", response_model=SIPTrunkResponse)
def create_trunk(trunk: SIPTrunkCreate, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    existing = db.query(SIPTrunk).filter(SIPTrunk.name == trunk.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Trunk name already exists")

    if trunk.auth_mode == "registration" and (not trunk.username or not trunk.password):
        raise HTTPException(status_code=400, detail="Username and password required for registration auth")

    # Determine SIP server: known provider or custom
    sip_server = resolve_provider_server(trunk.provider, trunk.auth_mode)
    if sip_server:
        pass
    elif trunk.provider == "telekom_companyflex":
        if trunk.sip_server:
            sip_server = trunk.sip_server
        else:
            raise HTTPException(status_code=400, detail="Outbound-Proxy (CompanyFlex-ID) muss angegeben werden")
    elif trunk.sip_server:
        sip_server = trunk.sip_server
    else:
        raise HTTPException(status_code=400, detail="SIP-Server muss angegeben werden")

    trunk_data = trunk.model_dump()
    # Override codecs for Telekom trunks if default is used
    if trunk.provider in ("telekom_deutschlandlan", "telekom_allip") and trunk_data.get("codecs") in (DEFAULT_CODECS, "", None):
        trunk_data["codecs"] = "alaw,g722"
    trunk_data["sip_server"] = sip_server

    db_trunk = SIPTrunk(**trunk_data)
    db.add(db_trunk)
    db.commit()
    db.refresh(db_trunk)

    logger.info(f"Created SIP trunk: {trunk.name}")
    log_action(db, current_user.username, "trunk_created", "trunk", trunk.name,
               {"provider": trunk.provider}, request.client.host if request.client else None)
    regenerate_config(db)

    return db_trunk


@router.put("/{trunk_id}", response_model=SIPTrunkResponse)
def update_trunk(trunk_id: int, trunk: SIPTrunkUpdate, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_trunk = db.query(SIPTrunk).filter(SIPTrunk.id == trunk_id).first()
    if not db_trunk:
        raise HTTPException(status_code=404, detail="Trunk not found")

    if trunk.name != db_trunk.name:
        existing = db.query(SIPTrunk).filter(SIPTrunk.name == trunk.name).first()
        if existing:
            raise HTTPException(status_code=400, detail="Trunk name already exists")

    if trunk.auth_mode == "registration" and (not trunk.username or not trunk.password):
        raise HTTPException(status_code=400, detail="Username and password required for registration auth")

    # Determine SIP server: known provider or custom
    sip_server = resolve_provider_server(trunk.provider, trunk.auth_mode)
    if sip_server:
        pass
    elif trunk.provider == "telekom_companyflex":
        if trunk.sip_server:
            sip_server = trunk.sip_server
        else:
            raise HTTPException(status_code=400, detail="Outbound-Proxy (CompanyFlex-ID) muss angegeben werden")
    elif trunk.sip_server:
        sip_server = trunk.sip_server
    else:
        raise HTTPException(status_code=400, detail="SIP-Server muss angegeben werden")

    for key, value in trunk.model_dump().items():
        setattr(db_trunk, key, value)

    # Override codecs for Telekom trunks if default is used
    if trunk.provider in ("telekom_deutschlandlan", "telekom_allip") and db_trunk.codecs in (DEFAULT_CODECS, "", None):
        db_trunk.codecs = "alaw,g722"
    db_trunk.sip_server = sip_server
    db_trunk.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(db_trunk)

    logger.info(f"Updated SIP trunk: {trunk.name}")
    log_action(db, current_user.username, "trunk_updated", "trunk", trunk.name,
               {"provider": trunk.provider}, request.client.host if request.client else None)
    regenerate_config(db)

    return db_trunk


@router.delete("/{trunk_id}")
def delete_trunk(trunk_id: int, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db_trunk = db.query(SIPTrunk).filter(SIPTrunk.id == trunk_id).first()
    if not db_trunk:
        raise HTTPException(status_code=404, detail="Trunk not found")

    name = db_trunk.name

    # Delete associated inbound routes first
    routes = db.query(InboundRoute).filter(InboundRoute.trunk_id == trunk_id).all()
    for route in routes:
        db.delete(route)

    db.delete(db_trunk)
    db.commit()

    logger.info(f"Deleted SIP trunk: {name} (and {len(routes)} inbound routes)")
    log_action(db, current_user.username, "trunk_deleted", "trunk", name,
               None, request.client.host if request.client else None)
    regenerate_config(db)

    return {"status": "deleted", "name": name}


def expand_number_block(number_block: str) -> list[str]:
    """Expand a number block like '012345678900-9' into individual DIDs.
    Format: {base_number}-{end_digit}
    The last digit of base_number is the start, end_digit is the end.
    """
    if not number_block or '-' not in number_block:
        return []
    parts = number_block.rsplit('-', 1)
    if len(parts) != 2:
        return []
    base = parts[0]
    end_str = parts[1].strip()
    if not base or not end_str.isdigit():
        return []
    prefix = base[:-1]
    start_digit = base[-1]
    if not start_digit.isdigit():
        return []
    start = int(start_digit)
    end = int(end_str)
    if end < start:
        return []
    return [f"{prefix}{d}" for d in range(start, end + 1)]


@router.get("/available-dids")
def get_available_dids(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get all available DIDs from trunk number blocks, excluding already assigned ones."""
    trunks = db.query(SIPTrunk).all()
    assigned_dids = {r.did for r in db.query(InboundRoute).all()}

    result = []
    for trunk in trunks:
        if not trunk.number_block:
            continue
        all_dids = expand_number_block(trunk.number_block)
        available = [d for d in all_dids if d not in assigned_dids]
        if available:
            result.append({
                "trunk_id": trunk.id,
                "trunk_name": trunk.name,
                "dids": available,
            })
    return result


@router.get("/{trunk_id}/status")
async def get_trunk_status(trunk_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get detailed status for a specific trunk including registration, endpoint, routes, and stats"""
    db_trunk = db.query(SIPTrunk).filter(SIPTrunk.id == trunk_id).first()
    if not db_trunk:
        raise HTTPException(status_code=404, detail="Trunk not found")

    trunk_data = {
        "id": db_trunk.id,
        "name": db_trunk.name,
        "provider": db_trunk.provider,
        "auth_mode": db_trunk.auth_mode,
        "sip_server": db_trunk.sip_server,
        "username": db_trunk.username,
        "caller_id": db_trunk.caller_id,
        "number_block": db_trunk.number_block,
        "codecs": db_trunk.codecs,
        "enabled": db_trunk.enabled,
    }

    ep_name = f"trunk-ep-{trunk_id}"

    # Registration status
    registration = {"status": "unknown", "expires": None, "last_response": None}
    endpoint_info = {"state": "unknown", "rtt": None, "contact_uri": None}

    if ami_client and ami_client.connected:
        # Get outbound registration status
        try:
            reg_response = await ami_client.manager.send_action({
                'Action': 'PJSIPShowRegistrationsOutbound'
            })
            if reg_response:
                for item in reg_response:
                    if item.get('Event') == 'OutboundRegistrationDetail':
                        obj_name = item.get('ObjectName', '')
                        if obj_name == f"trunk-{trunk_id}" or obj_name == f"trunk-reg-{trunk_id}":
                            status_val = item.get('Status', '')
                            registration['status'] = 'registered' if status_val == 'Registered' else status_val.lower() if status_val else 'unknown'
                            registration['expires'] = item.get('NextRegisterAttempt', None)
                            registration['last_response'] = item.get('ResponseBody', item.get('Response', None))
                            break
        except Exception as e:
            logger.error(f"Error fetching registration status for trunk {trunk_id}: {e}")

        # Get endpoint details
        try:
            ep_response = await ami_client.manager.send_action({
                'Action': 'PJSIPShowEndpoint',
                'Endpoint': ep_name
            })
            if ep_response:
                for item in ep_response:
                    if item.get('Event') == 'EndpointDetail':
                        endpoint_info['state'] = item.get('DeviceState', 'unknown')
                        break
        except Exception as e:
            logger.error(f"Error fetching endpoint for trunk {trunk_id}: {e}")

        # Get contacts (RTT/latency)
        try:
            contact_response = await ami_client.manager.send_action({
                'Action': 'PJSIPShowContacts',
                'Endpoint': ep_name
            })
            if contact_response:
                for item in contact_response:
                    try:
                        if item.get('Event') == 'ContactList':
                            rtt = item.get('RoundtripUsec', '0')
                            try:
                                endpoint_info['rtt'] = round(float(rtt) / 1000, 1)
                            except (ValueError, TypeError):
                                endpoint_info['rtt'] = 0
                            endpoint_info['contact_uri'] = item.get('Uri', None)
                            break
                    except AttributeError:
                        continue
        except Exception as e:
            logger.error(f"Error fetching contacts for trunk {trunk_id}: {e}")

    # Inbound routes for this trunk
    trunk_routes = db.query(InboundRoute).filter(InboundRoute.trunk_id == trunk_id).all()
    routes_data = [
        {
            "id": r.id,
            "did": r.did,
            "destination_extension": r.destination_extension,
            "description": r.description,
            "enabled": r.enabled,
        }
        for r in trunk_routes
    ]

    # CDR statistics
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())
    trunk_channel_pattern = f"%{ep_name}%"

    calls_today = db.query(func.count(CDR.id)).filter(
        CDR.call_date >= today_start,
        (CDR.channel.like(trunk_channel_pattern) | CDR.dstchannel.like(trunk_channel_pattern))
    ).scalar() or 0

    calls_week = db.query(func.count(CDR.id)).filter(
        CDR.call_date >= week_start,
        (CDR.channel.like(trunk_channel_pattern) | CDR.dstchannel.like(trunk_channel_pattern))
    ).scalar() or 0

    inbound_today = db.query(func.count(CDR.id)).filter(
        CDR.call_date >= today_start,
        CDR.channel.like(trunk_channel_pattern)
    ).scalar() or 0

    outbound_today = db.query(func.count(CDR.id)).filter(
        CDR.call_date >= today_start,
        CDR.dstchannel.like(trunk_channel_pattern)
    ).scalar() or 0

    return {
        "trunk": trunk_data,
        "registration": registration,
        "endpoint": endpoint_info,
        "routes": routes_data,
        "stats": {
            "calls_today": calls_today,
            "calls_week": calls_week,
            "inbound_today": inbound_today,
            "outbound_today": outbound_today,
        }
    }
