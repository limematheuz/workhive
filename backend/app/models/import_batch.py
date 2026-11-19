from sqlalchemy import Column,DateTime,ForeignKey,Integer,JSON,String,UniqueConstraint,func
from app.db.session import Base


class ImportBatch(Base):
    __tablename__="import_batches"
    __table_args__=(UniqueConstraint("company_id","digest",name="uq_import_company_digest"),)
    id=Column(Integer,primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False)
    digest=Column(String(64),nullable=False)
    kind=Column(String(20),nullable=False)
    result_ids=Column(JSON,nullable=False,default=list)
    created_by=Column(Integer,ForeignKey("users.id"),nullable=False)
    created_at=Column(DateTime(timezone=True),nullable=False,server_default=func.now())
