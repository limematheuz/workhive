from typing import Literal
from pydantic import BaseModel,Field,ConfigDict


class LinkDocument(BaseModel):
    source_type:Literal["staff_file","location_document"]
    source_id:int=Field(ge=1)


class SignDocument(BaseModel):
    model_config=ConfigDict(str_strip_whitespace=True)
    expected_revision:int=Field(ge=1)
    expected_hash:str=Field(pattern=r"^[a-f0-9]{64}$")
    signer_name:str=Field(min_length=2,max_length=200)
    confirmed:Literal[True]


class PublishDocument(BaseModel):
    revision_id:int|None=None
    expected_hash:str|None=Field(default=None,pattern=r"^[a-f0-9]{64}$")
