from pydantic import BaseModel, Field


class PageViewCreate(BaseModel):
    visitor_id: str = Field(min_length=12, max_length=96)
    path: str = Field(min_length=1, max_length=500)
    referrer: str | None = Field(default=None, max_length=1000)
    title: str | None = Field(default=None, max_length=250)
    screen: str | None = Field(default=None, max_length=50)
    timezone: str | None = Field(default=None, max_length=80)
    language: str | None = Field(default=None, max_length=40)
