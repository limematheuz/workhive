from sqlalchemy import Column,DateTime,ForeignKey,Integer,String,func
from app.db.session import Base


class StaffDocumentFile(Base):
    __tablename__="staff_document_files"
    id=Column(Integer,primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    employee_id=Column(Integer,ForeignKey("staff_employees.id"),nullable=False,index=True)
    name=Column(String(255),nullable=False)
    storage_key=Column(String(500),nullable=False,unique=True)
    content_type=Column(String(120),nullable=False)
    size_bytes=Column(Integer,nullable=False)
    sha256=Column(String(64),nullable=False)
    created_by=Column(Integer,ForeignKey("users.id"),nullable=False)
    created_at=Column(DateTime(timezone=True),nullable=False,server_default=func.now())
