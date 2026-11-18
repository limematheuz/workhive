from datetime import date
from typing import Literal
from pydantic import BaseModel,Field,ConfigDict


class LaborCommunicationInput(BaseModel):
    model_config=ConfigDict(str_strip_whitespace=True)
    employee_id:int=Field(ge=1)
    recipient_user_id:int=Field(ge=1)
    kind:Literal["hire","termination","contract_change","other"]
    effective_on:date
    subject:str=Field(min_length=2,max_length=200)
    description:str=Field(min_length=2,max_length=4000)
    document_revision_ids:list[int]=Field(default_factory=list,max_length=20)


class LaborCommunicationDecision(BaseModel):
    model_config=ConfigDict(str_strip_whitespace=True)
    expected_revision:int=Field(ge=1)
    status:Literal["received","processing","completed","rejected","cancelled"]
    note:str=Field(default="",max_length=2000)
