from pydantic import BaseModel,Field


class AutomationInput(BaseModel):
    recurring:bool=False
    documents:bool=False
    incidents:bool=False
    horizon_days:int=Field(default=7,ge=1,le=30)
