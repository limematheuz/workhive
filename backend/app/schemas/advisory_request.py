from typing import Literal
from pydantic import BaseModel,Field


class AdvisoryRequestInput(BaseModel):
    area:Literal["accounting","payroll"]
    description:str=Field(min_length=1,max_length=2000)


class AdvisoryResponse(BaseModel):
    response:str=Field(min_length=1,max_length=4000)
