from sqlalchemy import Column,ForeignKey,Integer,String,JSON
from app.db.session import Base


class SavedReport(Base):
    __tablename__="saved_reports"
    id=Column(Integer,primary_key=True)
    company_id=Column(Integer,ForeignKey("companies.id"),nullable=False,index=True)
    user_id=Column(Integer,ForeignKey("users.id"),nullable=False,index=True)
    name=Column(String(120),nullable=False)
    configuration=Column(JSON,nullable=False)
