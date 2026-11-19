from app.models.import_batch import ImportBatch
from app.models.company import Company


def existing_batch(db,company,digest):
    return db.query(ImportBatch).filter_by(company_id=company,digest=digest).first()


def lock_company(db,company):
    return db.query(Company).filter_by(id=company).with_for_update().one()
