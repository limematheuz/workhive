from sqlalchemy import Column,Integer,String,Text,Date,DateTime,ForeignKey,UniqueConstraint,CheckConstraint,func
from app.db.session import Base


class RegisteredDocument(Base):
    __tablename__="registered_documents"
    __table_args__=(CheckConstraint("owner_type IN ('client','location','staff')",name="ck_registered_document_owner"),)
    id=Column(Integer,primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    owner_type=Column(String(20),nullable=False)
    owner_id=Column(Integer,nullable=False)
    title=Column(String(255),nullable=False)
    document_type=Column(String(40),nullable=False,default="other")
    origin_staff_file_id=Column(Integer,ForeignKey("staff_document_files.id"),nullable=True,unique=True)
    origin_location_document_id=Column(Integer,ForeignKey("location_documents.id"),nullable=True,unique=True)
    published_revision=Column(Integer,nullable=True)
    created_by=Column(Integer,ForeignKey("users.id"),nullable=False)
    created_at=Column(DateTime(timezone=True),nullable=False,server_default=func.now())


class DocumentRevision(Base):
    __tablename__="document_revisions"
    __table_args__=(UniqueConstraint("document_id","revision",name="uq_document_revision"),)
    id=Column(Integer,primary_key=True)
    document_id=Column(Integer,ForeignKey("registered_documents.id"),nullable=False,index=True)
    revision=Column(Integer,nullable=False)
    title=Column(String(255),nullable=False)
    file_name=Column(String(255),nullable=False)
    content_type=Column(String(120),nullable=False)
    storage_key=Column(String(500),nullable=False)
    size_bytes=Column(Integer,nullable=False)
    sha256=Column(String(64),nullable=False)
    revision_hash=Column(String(64),nullable=False)
    staff_file_id=Column(Integer,ForeignKey("staff_document_files.id"),nullable=True)
    location_document_id=Column(Integer,ForeignKey("location_documents.id"),nullable=True)
    expires_on=Column(Date,nullable=True)
    created_by=Column(Integer,ForeignKey("users.id"),nullable=False)
    created_at=Column(DateTime(timezone=True),nullable=False,server_default=func.now())


class DocumentSignature(Base):
    __tablename__="document_signatures"
    __table_args__=(UniqueConstraint("revision_id","user_id",name="uq_document_signer"),)
    id=Column(Integer,primary_key=True)
    revision_id=Column(Integer,ForeignKey("document_revisions.id"),nullable=False,index=True)
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False)
    signer_name=Column(String(200),nullable=False)
    revision_hash=Column(String(64),nullable=False)
    statement_version=Column(String(50),nullable=False)
    consent_text=Column(Text,nullable=False)
    signed_at=Column(DateTime(timezone=True),nullable=False,server_default=func.now())
