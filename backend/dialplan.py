"""
Dialplan (extensions.conf) Generator
Generates from-trunk context for inbound DID routing
"""
import os
import logging
import subprocess
from typing import List, Optional
from database import InboundRoute, CallForward, VoicemailMailbox, SIPPeer, SIPTrunk

logger = logging.getLogger(__name__)

EXTENSIONS_CONFIG_PATH = "/etc/asterisk/custom/extensions.conf"


def _build_forward_map(forwards: List[CallForward]) -> dict:
    """Build a dict: extension -> {forward_type: CallForward}"""
    fwd_map: dict = {}
    for fwd in forwards:
        if fwd.extension not in fwd_map:
            fwd_map[fwd.extension] = {}
        fwd_map[fwd.extension][fwd.forward_type] = fwd
    return fwd_map


def _generate_dial_logic(extension: str, fwd_map: dict, ring_time: int = 30, early_answer: bool = False) -> str:
    """Generate dial logic for an extension with optional call forwarding.
    early_answer: if True, Answer() the channel before Dial() to stabilize
    the SIP dialog for inbound trunk calls (prevents provider BYE race condition).
    """
    forwards = fwd_map.get(extension, {})
    cfu = forwards.get("unconditional")
    cfb = forwards.get("busy")
    cfna = forwards.get("no_answer")

    lines = []

    # Unconditional forward - skip dialing the extension entirely
    if cfu:
        lines.append(f' same => n,NoOp(CFU active: forwarding to {cfu.destination})')
        if early_answer:
            lines.append(f' same => n,Answer()')
            lines.append(f' same => n,Wait(0.5)')
        lines.append(f' same => n,Dial(PJSIP/{cfu.destination}@trunk,{ring_time},tT)')
        lines.append(f' same => n,Hangup()')
        return "\n".join(lines)

    # Answer early for inbound trunk calls to prevent provider BYE race condition
    if early_answer:
        lines.append(f' same => n,Answer()')
        lines.append(f' same => n,Wait(0.5)')

    # Check if device is reachable before dialing - if not, go straight to voicemail
    actual_ring = cfna.ring_time if cfna else ring_time
    lines.append(f' same => n,Set(DEVICE_STATE=${{DEVICE_STATE(PJSIP/{extension})}})')
    lines.append(f' same => n,GotoIf($["${{DEVICE_STATE}}" = "UNAVAILABLE"]?unavail)')
    lines.append(f' same => n,GotoIf($["${{DEVICE_STATE}}" = "INVALID"]?unavail)')
    lines.append(f' same => n,Dial(PJSIP/{extension},{actual_ring},tTr)')

    if cfb and cfna:
        lines.append(f' same => n,GotoIf($["${{DIALSTATUS}}" = "BUSY"]?busy:noanswer)')
        lines.append(f' same => n(noanswer),NoOp(CFNA: forwarding to {cfna.destination})')
        lines.append(f' same => n,Dial(PJSIP/{cfna.destination}@trunk,30,tT)')
        lines.append(f' same => n,VoiceMail({extension}@default,u)')
        lines.append(f' same => n,Hangup()')
        lines.append(f' same => n(busy),NoOp(CFB: forwarding to {cfb.destination})')
        lines.append(f' same => n,Dial(PJSIP/{cfb.destination}@trunk,30,tT)')
        lines.append(f' same => n,VoiceMail({extension}@default,b)')
        lines.append(f' same => n,Hangup()')
    elif cfb:
        lines.append(f' same => n,GotoIf($["${{DIALSTATUS}}" = "BUSY"]?busy:unavail)')
        lines.append(f' same => n(unavail),VoiceMail({extension}@default,u)')
        lines.append(f' same => n,Hangup()')
        lines.append(f' same => n(busy),NoOp(CFB: forwarding to {cfb.destination})')
        lines.append(f' same => n,Dial(PJSIP/{cfb.destination}@trunk,30,tT)')
        lines.append(f' same => n,VoiceMail({extension}@default,b)')
        lines.append(f' same => n,Hangup()')
    elif cfna:
        lines.append(f' same => n,GotoIf($["${{DIALSTATUS}}" = "BUSY"]?busy:noanswer)')
        lines.append(f' same => n(noanswer),NoOp(CFNA: forwarding to {cfna.destination})')
        lines.append(f' same => n,Dial(PJSIP/{cfna.destination}@trunk,30,tT)')
        lines.append(f' same => n,VoiceMail({extension}@default,u)')
        lines.append(f' same => n,Hangup()')
        lines.append(f' same => n(busy),VoiceMail({extension}@default,b)')
        lines.append(f' same => n,Hangup()')
    else:
        # No forwarding - standard behavior
        lines.append(f' same => n,GotoIf($["${{DIALSTATUS}}" = "BUSY"]?busy:unavail)')
        lines.append(f' same => n(unavail),VoiceMail({extension}@default,u)')
        lines.append(f' same => n,Hangup()')
        lines.append(f' same => n(busy),VoiceMail({extension}@default,b)')
        lines.append(f' same => n,Hangup()')

    return "\n".join(lines)


def _build_outbound_map(routes: List[InboundRoute], peers: Optional[List[SIPPeer]] = None) -> dict:
    """Build a dict: extension -> {route, did, pai} for outbound calling.
    Uses peer.outbound_cid if set, otherwise falls back to first route's DID."""
    # Build peer lookup
    peer_map = {}
    if peers:
        for p in peers:
            peer_map[p.extension] = p

    # Build routes-per-extension
    routes_by_ext: dict = {}
    for route in routes:
        ext = route.destination_extension
        if ext not in routes_by_ext:
            routes_by_ext[ext] = []
        routes_by_ext[ext].append(route)

    outbound: dict = {}
    for ext, ext_routes in routes_by_ext.items():
        peer = peer_map.get(ext)
        # Determine outbound DID: peer.outbound_cid if set and valid, else first route
        selected_route = ext_routes[0]
        if peer and peer.outbound_cid:
            for r in ext_routes:
                if r.did == peer.outbound_cid:
                    selected_route = r
                    break
        outbound[ext] = {
            "route": selected_route,
            "pai": peer.pai if peer else None,
        }
    return outbound


def _build_ring_timeout_map(mailboxes: List[VoicemailMailbox]) -> dict:
    """Build a dict: extension -> ring_timeout"""
    return {mb.extension: (mb.ring_timeout or 20) for mb in mailboxes}


def generate_extensions_config(routes: List[InboundRoute], forwards: Optional[List[CallForward]] = None, mailboxes: Optional[List[VoicemailMailbox]] = None, peers: Optional[List[SIPPeer]] = None, trunks: Optional[List[SIPTrunk]] = None) -> str:
    """Generate extensions.conf with internal context, outbound routing, call forwarding, and from-trunk inbound routing"""

    fwd_map = _build_forward_map(forwards or [])
    outbound_map = _build_outbound_map(routes, peers)

    # Build trunk lookup for PAI domain
    trunk_map = {}
    if trunks:
        for t in trunks:
            trunk_map[t.id] = t
    ring_timeout_map = _build_ring_timeout_map(mailboxes or [])

    config = """; Auto-generated dialplan configuration
; Generated by Asterisk PBX GUI

[general]
static=yes
writeprotect=no
clearglobalvars=no

[globals]

[internal]
; Internal Extension Dialing (PJSIP)
exten => _1XXX,1,NoOp(Internal Call from ${CALLERID(all)} to ${EXTEN})
 same => n,Set(CALLERID(name)=${CALLERID(name)})
"""
    # Collect extensions that need per-extension overrides (forwarding or custom ring_timeout)
    override_extensions = set(fwd_map.keys())
    for ext, timeout in ring_timeout_map.items():
        if timeout != 20:
            override_extensions.add(ext)

    # Add forwarding logic for internal calls (default ring_timeout 20s)
    config += _generate_dial_logic("${EXTEN}", {}, 20)
    config += "\n\n"

    # Generate per-extension overrides
    for ext in sorted(override_extensions):
        ext_ring = ring_timeout_map.get(ext, 20)
        config += f"; Extension {ext} - custom rules\n"
        config += f"exten => {ext},1,NoOp(Call to {ext} with forwarding)\n"
        config += f" same => n,Set(CALLERID(name)=${{CALLERID(name)}})\n"
        config += _generate_dial_logic(ext, fwd_map, ext_ring)
        config += "\n\n"

    # === Outbound calling ===
    if outbound_map:
        config += "; === Outbound calling via assigned trunks ===\n"
        # Match external numbers: 0X. (national/international German dialing)
        config += "exten => _0X.,1,NoOp(Outbound call from ${CHANNEL(endpoint)} to ${EXTEN})\n"
        for ext in outbound_map:
            config += f' same => n,GotoIf($["${{CHANNEL(endpoint)}}x" = "{ext}x"]?out-{ext})\n'
        config += " same => n,NoOp(No outbound route for this extension)\n"
        config += " same => n,Playback(ss-noservice)\n"
        config += " same => n,Hangup()\n"
        for ext, info in outbound_map.items():
            route = info["route"]
            pai = info["pai"]
            tid = route.trunk_id
            config += f"\n same => n(out-{ext}),NoOp(Outbound via trunk-ep-{tid} with CID {route.did})\n"
            config += f" same => n,Set(CALLERID(num)={route.did})\n"
            if pai:
                trunk = trunk_map.get(tid)
                pai_domain = trunk.sip_server if trunk else "localhost"
                config += f" same => n,Set(PJSIP_HEADER(add,P-Asserted-Identity)=<sip:{pai}@{pai_domain}>)\n"
            config += f" same => n,Dial(PJSIP/${{EXTEN}}@trunk-ep-{tid},120,tT)\n"
            config += f" same => n,Hangup()\n"
        config += "\n"

        # Also match + prefixed numbers (international with +)
        config += "; International with + prefix\n"
        config += "exten => _+X.,1,NoOp(Outbound intl call from ${CHANNEL(endpoint)} to ${EXTEN})\n"
        for ext in outbound_map:
            config += f' same => n,GotoIf($["${{CHANNEL(endpoint)}}x" = "{ext}x"]?out-{ext})\n'
        config += " same => n,Playback(ss-noservice)\n"
        config += " same => n,Hangup()\n"
        for ext, info in outbound_map.items():
            route = info["route"]
            pai = info["pai"]
            tid = route.trunk_id
            config += f"\n same => n(out-{ext}),NoOp(Outbound via trunk-ep-{tid} with CID {route.did})\n"
            config += f" same => n,Set(CALLERID(num)={route.did})\n"
            if pai:
                trunk = trunk_map.get(tid)
                pai_domain = trunk.sip_server if trunk else "localhost"
                config += f" same => n,Set(PJSIP_HEADER(add,P-Asserted-Identity)=<sip:{pai}@{pai_domain}>)\n"
            config += f" same => n,Dial(PJSIP/${{EXTEN}}@trunk-ep-{tid},120,tT)\n"
            config += f" same => n,Hangup()\n"
        config += "\n"

    config += """; Voicemail access - dial *98 to check voicemail
exten => *98,1,NoOp(Voicemail Access for ${CALLERID(num)})
 same => n,Answer()
 same => n,Wait(0.5)
 same => n,VoiceMailMain(${CALLERID(num)}@default)
 same => n,Hangup()

; Voicemail direct - dial *97 + extension
exten => _*97XXXX,1,NoOp(Direct Voicemail for ${EXTEN:3})
 same => n,Answer()
 same => n,Wait(0.5)
 same => n,VoiceMail(${EXTEN:3}@default)
 same => n,Hangup()

; Echo test
exten => *43,1,Answer()
 same => n,Echo()
 same => n,Hangup()

[from-trunk]
; Inbound DID routing - auto-generated
"""

    # Handler for providers that send DID only in To header (no user in Request-URI)
    config += """
; Extract DID from To header when Request-URI has no user part
exten => s,1,NoOp(Inbound call with no DID in Request-URI)
 same => n,Set(TO_HDR=${PJSIP_HEADER(read,To)})
 same => n,Set(DID=${CUT(CUT(TO_HDR,@,1),:,2)})
 same => n,NoOp(Extracted DID: ${DID})
 same => n,GotoIf($[${LEN(${DID})} > 0]?from-trunk,${DID},1)
 same => n,NoOp(Could not extract DID from To header)
 same => n,Hangup()

"""

    if routes:
        for route in routes:
            desc = route.description or route.did
            ext = route.destination_extension
            config += f"\n; {desc}\n"
            config += f"exten => {route.did},1,NoOp(Inbound call to DID {route.did})\n"
            config += f" same => n,Set(CALLERID(name)=${{CALLERID(name)}})\n"
            ext_ring = ring_timeout_map.get(ext, 20)
            config += _generate_dial_logic(ext, fwd_map, ext_ring, early_answer=True)
            config += "\n"
    else:
        config += """
; No inbound routes configured
exten => _X.,1,NoOp(Unrouted inbound call to ${EXTEN})
 same => n,Hangup()
"""

    # Catch-all for unmatched DIDs
    config += """
; Catch-all for unmatched inbound calls
exten => _[+0-9].,1,NoOp(Unmatched inbound DID ${EXTEN})
 same => n,Hangup()
"""

    return config


def write_extensions_config(routes: List[InboundRoute], forwards: Optional[List[CallForward]] = None, mailboxes: Optional[List[VoicemailMailbox]] = None, peers: Optional[List[SIPPeer]] = None, trunks: Optional[List[SIPTrunk]] = None) -> bool:
    """Write extensions.conf to shared volume"""
    try:
        config_content = generate_extensions_config(routes, forwards, mailboxes, peers, trunks)

        os.makedirs(os.path.dirname(EXTENSIONS_CONFIG_PATH), exist_ok=True)

        with open(EXTENSIONS_CONFIG_PATH, 'w') as f:
            f.write(config_content)

        logger.info(f"extensions.conf written with {len(routes)} inbound routes")
        return True

    except Exception as e:
        logger.error(f"Failed to write extensions.conf: {e}")
        return False


def reload_dialplan() -> bool:
    """Reload Asterisk dialplan"""
    try:
        result = subprocess.run(
            ['docker', 'exec', 'pbx_asterisk', 'sh', '-c',
             'cp /etc/asterisk/custom/extensions.conf /etc/asterisk/extensions.conf && asterisk -rx "dialplan reload"'],
            capture_output=True,
            text=True,
            timeout=10
        )

        if result.returncode == 0:
            logger.info("Asterisk dialplan reloaded successfully")
            return True
        else:
            logger.error(f"Dialplan reload failed: {result.stderr}")
            return False

    except Exception as e:
        logger.error(f"Failed to reload dialplan: {e}")
        return False
