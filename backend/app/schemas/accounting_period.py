from pydantic import BaseModel,Field,ConfigDict,field_validator


class PeriodDecision(BaseModel):
    model_config=ConfigDict(extra="forbid",str_strip_whitespace=True)
    reason:str=Field(min_length=5,max_length=1000)
    expected_revision:int=Field(ge=0)
