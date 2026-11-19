from sqlalchemy import or_,and_,select,func,union_all
from app.models.document_register import RegisteredDocument,DocumentRevision,DocumentSignature
from app.models.staff_employee import StaffEmployee
from app.models.staff_document_file import StaffDocumentFile
from app.models.staff_account import StaffAccount
from app.models.location import Location
from app.models.location_document import LocationDocument
from app.models.client import Client
from app.models.user import User

OWNERS={"client":Client,"location":Location,"staff":StaffEmployee}


def owner(db,company,kind,id):
    model=OWNERS[kind]
    company_column=model.owner_company_id if kind=="location" else model.company_id
    return db.query(model).filter(model.id==id,company_column==company).first()


def owners(db,company,kind,ids=None):
    model=OWNERS[kind]
    company_column=model.owner_company_id if kind=="location" else model.company_id
    query=db.query(model).filter(company_column==company)
    if ids is not None:query=query.filter(model.id.in_(ids))
    return query.order_by(model.name,model.id).all()


def own_employee(db,company,user):
    return db.query(StaffEmployee).join(StaffAccount,StaffAccount.employee_id==StaffEmployee.id).filter(StaffEmployee.company_id==company,StaffAccount.user_id==user).first()


def document(db,id,lock=False):
    query=db.query(RegisteredDocument).filter_by(id=id)
    return (query.populate_existing().with_for_update() if lock else query).first()


def source(db,kind,id):
    model=StaffDocumentFile if kind=="staff_file" else LocationDocument
    return db.query(model).filter_by(id=id).populate_existing().with_for_update().first()


def source_record(db,kind,id):
    field=DocumentRevision.staff_file_id if kind=="staff_file" else DocumentRevision.location_document_id
    return db.query(RegisteredDocument).join(DocumentRevision,DocumentRevision.document_id==RegisteredDocument.id).filter(field==id).first()


def records(db,company,allowed):
    clauses=[and_(RegisteredDocument.owner_type==kind,RegisteredDocument.owner_id.in_(ids)) for kind,ids in allowed.items() if ids]
    if not clauses:return []
    return db.query(RegisteredDocument).filter(RegisteredDocument.company_id==company,or_(*clauses)).order_by(RegisteredDocument.id.desc()).all()


def revisions(db,ids):
    return db.query(DocumentRevision).filter(DocumentRevision.document_id.in_(ids)).order_by(DocumentRevision.revision.desc()).all() if ids else []


def revision(db,id):return db.get(DocumentRevision,id)


def signatures(db,ids):
    return db.query(DocumentSignature,User.full_name).join(User,User.id==DocumentSignature.user_id).filter(DocumentSignature.revision_id.in_(ids)).order_by(DocumentSignature.id).all() if ids else []


def legacy_sources(db,company,kind,ids):
    if not ids:return []
    if kind=="staff":
        linked=select(DocumentRevision.staff_file_id).where(DocumentRevision.staff_file_id.is_not(None))
        return db.query(StaffDocumentFile).filter(StaffDocumentFile.company_id==company,StaffDocumentFile.employee_id.in_(ids),StaffDocumentFile.id.not_in(linked)).order_by(StaffDocumentFile.id.desc()).all()
    linked=select(DocumentRevision.location_document_id).where(DocumentRevision.location_document_id.is_not(None))
    return db.query(LocationDocument).filter(LocationDocument.company_id==company,LocationDocument.location_id.in_(ids),LocationDocument.archived_at.is_(None),LocationDocument.id.not_in(linked)).order_by(LocationDocument.id.desc()).all()


def client_documents(db,grant):
    locations=select(Location.id).where(Location.client_id==grant.client_id,Location.owner_company_id==grant.company_id)
    return db.query(RegisteredDocument).filter(RegisteredDocument.company_id==grant.company_id,RegisteredDocument.published_revision.is_not(None),or_(and_(RegisteredDocument.owner_type=="client",RegisteredDocument.owner_id==grant.client_id),and_(RegisteredDocument.owner_type=="location",RegisteredDocument.owner_id.in_(locations)))).order_by(RegisteredDocument.id.desc()).all()


def client_document(db,grant,id):
    row=document(db,id)
    if row is None or row.company_id!=grant.company_id or row.published_revision is None:return None
    if row.owner_type=="client" and row.owner_id==grant.client_id:return row
    if row.owner_type=="location":
        site=owner(db,grant.company_id,"location",row.owner_id)
        if site and site.client_id==grant.client_id:return row
    return None


def extra_used_bytes(db,company):
    return int(db.query(func.coalesce(func.sum(DocumentRevision.size_bytes),0)).join(RegisteredDocument).filter(RegisteredDocument.company_id==company,DocumentRevision.staff_file_id.is_(None),DocumentRevision.location_document_id.is_(None)).scalar())


def used_bytes(db,company):
    files=union_all(select(StaffDocumentFile.storage_key,StaffDocumentFile.size_bytes).where(StaffDocumentFile.company_id==company),select(LocationDocument.storage_key,LocationDocument.size_bytes).where(LocationDocument.company_id==company,LocationDocument.archived_at.is_(None)),select(DocumentRevision.storage_key,DocumentRevision.size_bytes).join(RegisteredDocument).where(RegisteredDocument.company_id==company)).subquery()
    unique=select(func.max(files.c.size_bytes).label("size")).group_by(files.c.storage_key).subquery()
    return int(db.query(func.coalesce(func.sum(unique.c.size),0)).scalar())
