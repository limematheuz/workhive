from sqlalchemy.orm import Session
from app.models.company import Company
from app.schemas.company import CompanyCreate, CompanyUpdate


def get_company_by_id(db: Session, company_id: int) -> Company | None:
    return db.query(Company).filter(Company.id == company_id).first()


def get_company_by_tax_id(db: Session, tax_id: str) -> Company | None:
    return db.query(Company).filter(Company.tax_id == tax_id).first()


def get_all_companies(db: Session, skip: int = 0, limit: int = 100) -> list[Company]:
    return (
        db.query(Company)
        .order_by(Company.is_active.desc(), Company.name.asc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def create_company(db: Session, company_data: CompanyCreate) -> Company:
    db_company = Company(**company_data.model_dump())
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company


def update_company(
    db: Session, db_company: Company, company_data: CompanyUpdate
) -> Company:
    update_data = company_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_company, key, value)
    db.add(db_company)
    db.commit()
    db.refresh(db_company)
    return db_company
