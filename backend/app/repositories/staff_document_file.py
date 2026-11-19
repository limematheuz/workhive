from sqlalchemy import func
from app.models.staff_document_file import StaffDocumentFile
from app.models.location_document import LocationDocument


def get(db,file_id):
    return db.get(StaffDocumentFile,file_id)


def used_bytes(db,company):
    from app.repositories.document_register import used_bytes as registered_usage
    return registered_usage(db,company)
