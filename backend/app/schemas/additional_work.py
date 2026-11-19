from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class WorkRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=10000)
    location_id: int


class QuoteLink(BaseModel):
    quote_id: int


class Schedule(BaseModel):
    starts_at: datetime
