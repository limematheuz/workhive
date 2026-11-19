from pydantic import BaseModel, Field

class ContractHours(BaseModel):
    minutes: int = Field(ge=0,le=10000000)


class Approval(BaseModel):
    signature: str = Field(min_length=64,max_length=64)
