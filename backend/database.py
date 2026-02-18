"""
Database configuration and models
SQLAlchemy ORM setup
"""

import os
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://asterisk:changeme@postgres:5432/asterisk_gui"
)

# Create engine
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100))
    role = Column(String(20), default="user")
    created_at = Column(DateTime, default=datetime.utcnow)
    avatar_url = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    sip_peers = relationship("SIPPeer", back_populates="user")
    extensions = relationship("Extension", back_populates="user")


class SIPPeer(Base):
    __tablename__ = "sip_peers"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    extension = Column(String(20), unique=True, nullable=False, index=True)
    secret = Column(String(100), nullable=False)
    caller_id = Column(String(100))
    context = Column(String(50), default="internal")
    host = Column(String(50), default="dynamic")
    nat = Column(String(20), default="force_rport,comedia")
    type = Column(String(20), default="friend")
    codecs = Column(String(200), nullable=True)  # NULL = use global codecs
    outbound_cid = Column(String(50), nullable=True)  # Selected outbound DID, NULL = first route's DID
    pai = Column(String(50), nullable=True)  # P-Asserted-Identity number, NULL = no PAI header
    blf_enabled = Column(Boolean, default=True)  # Enable BLF hints for this peer
    pickup_group = Column(String(50), nullable=True)  # Call/Pickup group(s), e.g. "1" or "1,2"
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="sip_peers")


class Extension(Base):
    __tablename__ = "extensions"
    
    id = Column(Integer, primary_key=True, index=True)
    extension = Column(String(20), unique=True, nullable=False, index=True)
    description = Column(String(255))
    type = Column(String(20), default="internal")  # internal, external, queue, ivr
    destination = Column(String(100))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="extensions")


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    owner_extension = Column(String(20), nullable=True, index=True)  # NULL = global address book
    name = Column(String(100), nullable=False)
    internal_extension = Column(String(20), nullable=True)
    external_number = Column(String(50), nullable=True)
    company = Column(String(100), nullable=True)
    tag = Column(String(50), nullable=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SIPTrunk(Base):
    __tablename__ = "sip_trunks"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    provider = Column(String(50), nullable=False)  # plusnet_basic | plusnet_connect
    auth_mode = Column(String(20), default="registration")  # registration | ip
    sip_server = Column(String(200), nullable=False)
    username = Column(String(100), nullable=True)
    password = Column(String(200), nullable=True)
    caller_id = Column(String(100), nullable=True)
    number_block = Column(String(100), nullable=True)
    context = Column(String(50), default="from-trunk")
    codecs = Column(String(200), default="ulaw,alaw,g722")
    from_user = Column(String(100), nullable=True)  # From-User / Anschlussnummer (e.g. +49VORWAHLRUFNUMMER)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class RingGroup(Base):
    __tablename__ = "ring_groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    extension = Column(String(20), unique=True, nullable=False, index=True)
    inbound_trunk_id = Column(Integer, ForeignKey("sip_trunks.id"), nullable=True)
    inbound_did = Column(String(50), nullable=True)
    strategy = Column(String(30), default="ringall")  # ringall | roundrobin | leastrecent
    ring_time = Column(Integer, default=20)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    members = relationship("RingGroupMember", back_populates="group", cascade="all, delete-orphan")


class RingGroupMember(Base):
    __tablename__ = "ring_group_members"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(Integer, ForeignKey("ring_groups.id"), nullable=False)
    extension = Column(String(20), nullable=False)
    position = Column(Integer, default=0)

    group = relationship("RingGroup", back_populates="members")

class IVRMenu(Base):
    __tablename__ = "ivr_menus"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    extension = Column(String(20), unique=True, nullable=False, index=True)
    prompt = Column(String(200), nullable=True)  # Audio file name in Asterisk sounds
    timeout_seconds = Column(Integer, default=5)
    timeout_destination = Column(String(20), nullable=True)
    retries = Column(Integer, default=2)
    inbound_trunk_id = Column(Integer, ForeignKey("sip_trunks.id"), nullable=True)
    inbound_did = Column(String(50), nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    options = relationship("IVROption", back_populates="menu", cascade="all, delete-orphan")


class IVROption(Base):
    __tablename__ = "ivr_options"

    id = Column(Integer, primary_key=True, index=True)
    menu_id = Column(Integer, ForeignKey("ivr_menus.id"), nullable=False)
    digit = Column(String(5), nullable=False)  # 0-9,*,#
    destination = Column(String(20), nullable=False)
    position = Column(Integer, default=0)

    menu = relationship("IVRMenu", back_populates="options")

class InboundRoute(Base):
    __tablename__ = "inbound_routes"

    id = Column(Integer, primary_key=True, index=True)
    did = Column(String(50), unique=True, nullable=False, index=True)  # E.164 e.g. +49221123456
    trunk_id = Column(Integer, ForeignKey("sip_trunks.id"), nullable=False)
    destination_extension = Column(String(20), nullable=False)  # e.g. 1001
    description = Column(String(200), nullable=True)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    trunk = relationship("SIPTrunk")


class CallForward(Base):
    __tablename__ = "call_forwards"

    id = Column(Integer, primary_key=True, index=True)
    extension = Column(String(20), nullable=False, index=True)
    forward_type = Column(String(20), nullable=False)  # unconditional, busy, no_answer
    destination = Column(String(100), nullable=False)  # target number
    ring_time = Column(Integer, default=20)  # seconds before no-answer forward
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class CDR(Base):
    __tablename__ = "cdr"
    
    id = Column(Integer, primary_key=True, index=True)
    call_date = Column(DateTime, default=datetime.utcnow, index=True)
    clid = Column(String(80))
    src = Column(String(80), index=True)
    dst = Column(String(80), index=True)
    dcontext = Column(String(80))
    channel = Column(String(80))
    dstchannel = Column(String(80))
    lastapp = Column(String(80))
    lastdata = Column(String(80))
    duration = Column(Integer)
    billsec = Column(Integer)
    disposition = Column(String(45))
    amaflags = Column(Integer)
    uniqueid = Column(String(150))
    userfield = Column(String(255))


class VoicemailMailbox(Base):
    __tablename__ = "voicemail_mailboxes"

    id = Column(Integer, primary_key=True, index=True)
    extension = Column(String(20), unique=True, nullable=False, index=True)
    enabled = Column(Boolean, default=True)
    pin = Column(String(20), default="1234")
    name = Column(String(100), nullable=True)
    email = Column(String(200), nullable=True)
    ring_timeout = Column(Integer, default=20)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SystemSettings(Base):
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text)
    description = Column(Text)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    username = Column(String(50), nullable=False, index=True)
    action = Column(String(50), nullable=False, index=True)
    resource_type = Column(String(50), nullable=True)
    resource_id = Column(String(100), nullable=True)
    details = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
