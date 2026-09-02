from sqlalchemy.orm import Session, selectinload

from app.models.client_contact import ClientContact, ClientContactRole


def list_for_client(db: Session, client_id: int) -> list[ClientContact]:
    return (
        db.query(ClientContact)
        .options(selectinload(ClientContact.roles))
        .filter(ClientContact.client_id == client_id)
        .order_by(
            ClientContact.is_active.desc(),
            ClientContact.is_primary.desc(),
            ClientContact.full_name.asc(),
            ClientContact.id.asc(),
        )
        .all()
    )


def get_for_client(
    db: Session, client_id: int, contact_id: int
) -> ClientContact | None:
    return (
        db.query(ClientContact)
        .options(selectinload(ClientContact.roles))
        .filter(
            ClientContact.id == contact_id,
            ClientContact.client_id == client_id,
        )
        .first()
    )


def clear_primary_for_client(
    db: Session, client_id: int, *, except_contact_id: int | None = None
) -> None:
    query = db.query(ClientContact).filter(
        ClientContact.client_id == client_id,
        ClientContact.is_primary.is_(True),
    )
    if except_contact_id is not None:
        query = query.filter(ClientContact.id != except_contact_id)
    query.update({ClientContact.is_primary: False}, synchronize_session=False)


def replace_roles(
    db: Session, contact: ClientContact, roles: list[str]
) -> None:
    contact.roles.clear()
    db.flush()
    contact.roles.extend(ClientContactRole(role=role) for role in roles)
