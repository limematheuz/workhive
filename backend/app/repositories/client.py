from sqlalchemy.orm import Session
from app.models.client import Client
from app.schemas.client import ClientCreate, ClientUpdate


def get_client_by_legal_number(
    db: Session, company_id: int | None, legal_number: str | None
) -> Client | None:
    if not legal_number:
        return None
    query = db.query(Client)
    if company_id is not None:
        query = query.filter(Client.company_id == company_id)
    return query.filter(Client.legal_number == legal_number).first()


def get_client_by_id(db: Session, client_id: int, company_id: int | None) -> Client | None:
    query = db.query(Client)
    if company_id is not None:
        query = query.filter(Client.company_id == company_id)
    return query.filter(Client.id == client_id).first()


def get_all_clients(
    db: Session,
    company_id: int | None,
    skip: int = 0,
    limit: int = 100,
    is_active: bool | None = True,
) -> list[Client]:

    query = db.query(Client)
    if company_id is not None:
        query = query.filter(Client.company_id == company_id)
    
    if is_active is not None:
        query = query.filter(Client.is_active.is_(is_active))
        
    return query.offset(skip).limit(limit).all()


def create_client(db: Session, client_data: ClientCreate) -> Client:
    data = client_data.model_dump()
    for optional_field in ("legal_number", "email", "phone"):
        if data.get(optional_field) == "":
            data[optional_field] = None
    db_client = Client(**data)
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client


def update_client(db: Session, db_client: Client, client_data: ClientUpdate) -> Client:
    update_data = client_data.model_dump(exclude_unset=True)
    for optional_field in ("legal_number", "email", "phone"):
        if update_data.get(optional_field) == "":
            update_data[optional_field] = None
    for key, value in update_data.items():
        setattr(db_client, key, value)

    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client


def delete_client(db: Session, db_client: Client) -> Client:
    db_client.is_active = False
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client
