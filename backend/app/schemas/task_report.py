from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


TaskReportType = Literal[
    "issue",
    "note",
    "photo",
    "checklist_note",
    "checklist_photo",
]


class TaskReportCreate(BaseModel):
    task_item_id: int = Field(gt=0)
    client_event_id: UUID
    report_type: TaskReportType
    title: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=4000)
    issue_type: str | None = Field(default=None, max_length=80)
    element: str | None = Field(default=None, max_length=80)
    media_url: str | None = Field(default=None, max_length=700)
    file_name: str | None = Field(default=None, max_length=255)
    checklist_item_id: int | None = Field(default=None, gt=0)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validate_report_shape(self):
        self.title = self.title.strip() if self.title else None
        self.description = self.description.strip() if self.description else None
        self.issue_type = self.issue_type.strip() if self.issue_type else None
        self.element = self.element.strip() if self.element else None
        self.file_name = self.file_name.strip() if self.file_name else None

        if self.report_type == "issue" and not self.title:
            raise ValueError("Issue reports require a title")
        if self.report_type in {"note", "checklist_note"} and not self.description:
            raise ValueError("Note reports require a description")
        if self.report_type in {"photo", "checklist_photo"} and not self.media_url:
            raise ValueError("Photo reports require uploaded media")
        if self.report_type.startswith("checklist_") and self.checklist_item_id is None:
            raise ValueError("Checklist reports require a checklist item")
        if not self.report_type.startswith("checklist_") and self.checklist_item_id is not None:
            raise ValueError("Checklist item is only valid for checklist reports")
        return self


class TaskReportResponse(BaseModel):
    id: int
    task_item_id: int
    reporter_user_id: int | None
    reporter_company_id: int
    requesting_company_id: int | None
    report_type: TaskReportType
    title: str | None
    description: str | None
    issue_type: str | None
    element: str | None
    file_name: str | None
    checklist_item_id: int | None
    checklist_item_label: str | None
    reporter_name: str
    reporter_company_name: str
    requesting_company_name: str | None
    task_title: str
    location_name: str
    media_url: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
