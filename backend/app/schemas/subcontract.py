from datetime import date
from decimal import Decimal
from typing import Literal
from pydantic import BaseModel,Field,field_validator


class SubcontractInput(BaseModel):
    work_order_id:int=Field(ge=1)
    supplier_id:int=Field(ge=1)
    amount:Decimal=Field(ge=0,max_digits=12,decimal_places=2)
    description:str=Field(min_length=1,max_length=255)
    document_url:str|None=Field(default=None,max_length=2000)
    document_expires_on:date|None=None

    @field_validator("document_url")
    @classmethod
    def secure_document(cls,value):
        if value and not value.startswith("https://"):raise ValueError("Usa un enlace HTTPS al documento del proveedor.")
        return value


class SubcontractReview(BaseModel):
    status:Literal["progress","completed","cancelled"]
