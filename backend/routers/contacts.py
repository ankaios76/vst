"""
Contacts Router
Global and per-extension address book
"""

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import csv
import io

from database import get_db, Contact, SIPPeer, User
from auth import get_current_user

router = APIRouter()


class ContactBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    internal_extension: Optional[str] = Field(None, max_length=20)
    external_number: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=100)
    tag: Optional[str] = Field(None, max_length=50)
    note: Optional[str] = None


class ContactCreate(ContactBase):
    scope: Literal["global", "extension"]
    owner_extension: Optional[str] = Field(None, max_length=20)


class ContactUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    internal_extension: Optional[str] = Field(None, max_length=20)
    external_number: Optional[str] = Field(None, max_length=50)
    company: Optional[str] = Field(None, max_length=100)
    tag: Optional[str] = Field(None, max_length=50)
    note: Optional[str] = None


class ContactOut(ContactBase):
    id: int
    owner_extension: Optional[str] = None

    class Config:
        orm_mode = True


def _get_user_extension(db: Session, user: User) -> Optional[str]:
    peer = db.query(SIPPeer).filter(SIPPeer.user_id == user.id).first()
    if peer:
        return peer.extension
    return None


def _ensure_read_access(scope: str, extension: Optional[str], current_user: User, db: Session):
    if current_user.role == "admin":
        return
    if scope == "global":
        return
    user_ext = _get_user_extension(db, current_user)
    if not user_ext:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Nebenstelle zugewiesen")
    if extension != user_ext:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung für diese Nebenstelle")


def _ensure_write_access(scope: str, extension: Optional[str], current_user: User, db: Session):
    if current_user.role == "admin":
        return
    if scope == "global":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Nur Admins dürfen das globale Telefonbuch verwalten")
    user_ext = _get_user_extension(db, current_user)
    if not user_ext:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Nebenstelle zugewiesen")
    if extension != user_ext:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Keine Berechtigung für diese Nebenstelle")


@router.get("/", response_model=List[ContactOut])
def list_contacts(
    scope: Literal["global", "extension", "all"] = "global",
    extension: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if scope == "global":
        _ensure_read_access("global", None, current_user, db)
        return db.query(Contact).filter(Contact.owner_extension.is_(None)).order_by(Contact.name.asc()).all()
    if scope == "extension":
        if not extension:
            raise HTTPException(status_code=400, detail="extension erforderlich")
        _ensure_read_access("extension", extension, current_user, db)
        return db.query(Contact).filter(Contact.owner_extension == extension).order_by(Contact.name.asc()).all()
    if scope == "all":
        if current_user.role != "admin":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Nur Admins dürfen alle Kontakte sehen")
        return db.query(Contact).order_by(Contact.name.asc()).all()
    raise HTTPException(status_code=400, detail="Ungültiger scope")


@router.post("/", response_model=ContactOut)
def create_contact(
    data: ContactCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.scope == "global":
        _ensure_write_access("global", None, current_user, db)
        owner_ext = None
    else:
        if not data.owner_extension:
            raise HTTPException(status_code=400, detail="owner_extension erforderlich")
        _ensure_write_access("extension", data.owner_extension, current_user, db)
        owner_ext = data.owner_extension

    contact = Contact(
        owner_extension=owner_ext,
        name=data.name.strip(),
        internal_extension=(data.internal_extension or "").strip() or None,
        external_number=(data.external_number or "").strip() or None,
        company=(data.company or "").strip() or None,
        tag=(data.tag or "").strip() or None,
        note=(data.note or "").strip() or None,
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.put("/{contact_id}", response_model=ContactOut)
def update_contact(
    contact_id: int,
    data: ContactUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Kontakt nicht gefunden")
    scope = "global" if contact.owner_extension is None else "extension"
    _ensure_write_access(scope, contact.owner_extension, current_user, db)

    if data.name is not None:
        contact.name = data.name.strip()
    if data.internal_extension is not None:
        contact.internal_extension = data.internal_extension.strip() or None
    if data.external_number is not None:
        contact.external_number = data.external_number.strip() or None
    if data.company is not None:
        contact.company = data.company.strip() or None
    if data.tag is not None:
        contact.tag = data.tag.strip() or None
    if data.note is not None:
        contact.note = data.note.strip() or None

    db.commit()
    db.refresh(contact)
    return contact


@router.delete("/{contact_id}")
def delete_contact(
    contact_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contact = db.query(Contact).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(status_code=404, detail="Kontakt nicht gefunden")
    scope = "global" if contact.owner_extension is None else "extension"
    _ensure_write_access(scope, contact.owner_extension, current_user, db)
    db.delete(contact)
    db.commit()
    return {"message": "Kontakt gelöscht"}


@router.get("/export")
def export_contacts(
    scope: Literal["global", "extension"] = Query("global"),
    extension: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if scope == "global":
        _ensure_read_access("global", None, current_user, db)
        contacts = db.query(Contact).filter(Contact.owner_extension.is_(None)).order_by(Contact.name.asc()).all()
        filename = "contacts-global.csv"
    else:
        if not extension:
            raise HTTPException(status_code=400, detail="extension erforderlich")
        _ensure_read_access("extension", extension, current_user, db)
        contacts = db.query(Contact).filter(Contact.owner_extension == extension).order_by(Contact.name.asc()).all()
        filename = f"contacts-{extension}.csv"

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["name", "internal_extension", "external_number", "company", "tag", "note"])
    for c in contacts:
        writer.writerow([
            c.name or "",
            c.internal_extension or "",
            c.external_number or "",
            c.company or "",
            c.tag or "",
            c.note or "",
        ])
    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/import")
async def import_contacts(
    scope: Literal["global", "extension"] = Query("global"),
    extension: Optional[str] = Query(None),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if scope == "global":
        _ensure_write_access("global", None, current_user, db)
        owner_ext = None
    else:
        if not extension:
            raise HTTPException(status_code=400, detail="extension erforderlich")
        _ensure_write_access("extension", extension, current_user, db)
        owner_ext = extension

    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Nur CSV-Dateien erlaubt")

    raw = await file.read()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=400, detail="Leere CSV-Datei")

    headers = [h.strip().lower() for h in rows[0]]
    use_header = "name" in headers

    contacts_created = 0
    if use_header:
        dict_reader = csv.DictReader(io.StringIO(text))
        for row in dict_reader:
            name = (row.get("name") or "").strip()
            if not name:
                continue
            contact = Contact(
                owner_extension=owner_ext,
                name=name,
                internal_extension=(row.get("internal_extension") or "").strip() or None,
                external_number=(row.get("external_number") or "").strip() or None,
                company=(row.get("company") or "").strip() or None,
                tag=(row.get("tag") or "").strip() or None,
                note=(row.get("note") or "").strip() or None,
            )
            db.add(contact)
            contacts_created += 1
    else:
        # Expect: name, internal_extension, external_number, company, tag, note
        for row in rows:
            if not row:
                continue
            name = (row[0] if len(row) > 0 else "").strip()
            if not name:
                continue
            contact = Contact(
                owner_extension=owner_ext,
                name=name,
                internal_extension=(row[1] if len(row) > 1 else "").strip() or None,
                external_number=(row[2] if len(row) > 2 else "").strip() or None,
                company=(row[3] if len(row) > 3 else "").strip() or None,
                tag=(row[4] if len(row) > 4 else "").strip() or None,
                note=(row[5] if len(row) > 5 else "").strip() or None,
            )
            db.add(contact)
            contacts_created += 1

    db.commit()
    return {"created": contacts_created}
