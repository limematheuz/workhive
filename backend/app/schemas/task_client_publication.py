from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class PublishTaskPart(BaseModel):
    public_summary: str = Field(min_length=1, max_length=4000)
    checklist_item_ids: list[int] = Field(default_factory=list, max_length=200)
    report_ids: list[int] = Field(default_factory=list, max_length=30)
    expected_revision: int = Field(ge=0)
    expected_source_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    confirmed_publication: bool = Field(strict=True)
    model_config = ConfigDict(extra="forbid")

    @field_validator("public_summary")
    @classmethod
    def trimmed_summary(cls, value):
        if not value.strip():
            raise ValueError("Escribe un resumen público para el cliente.")
        return value.strip()

    @model_validator(mode="after")
    def explicit_selection(self):
        if not self.confirmed_publication:
            raise ValueError("Confirma qué información se publicará al cliente.")
        for values in (self.checklist_item_ids, self.report_ids):
            if len(values) != len(set(values)) or any(value < 1 for value in values):
                raise ValueError("Selecciona registros únicos y válidos.")
        return self


class AcceptTaskPart(BaseModel):
    expected_revision: int = Field(ge=1)
    expected_manifest_hash: str = Field(pattern=r"^[0-9a-f]{64}$")
    signer_name: str = Field(min_length=1, max_length=255)
    confirmed: bool = Field(strict=True)
    model_config = ConfigDict(extra="forbid")

    @field_validator("signer_name")
    @classmethod
    def trimmed_name(cls, value):
        if not value.strip():
            raise ValueError("Indica el nombre del representante.")
        return value.strip()

    @model_validator(mode="after")
    def explicit_consent(self):
        if not self.confirmed:
            raise ValueError("Confirma la revisión del parte publicado.")
        return self


class PublishedChecklist(BaseModel):
    reference: str | None = None
    text: str
    completed: bool
    space_name: str | None


class PublishedReport(BaseModel):
    reference: str | None = None
    kind: Literal["issue", "note", "photo", "checklist_note", "checklist_photo"]
    title: str | None
    text: str | None
    checklist_label: str | None
    created_at: datetime


class PublishedPhoto(BaseModel):
    id: str
    file_name: str
    content_type: str
    sha256: str
    byte_size: int


class WorkManifest(BaseModel):
    schema_version: Literal[1]
    task_id: int
    title: str
    location_name: str
    timezone: str
    scheduled_start_at: datetime | None
    started_at: datetime | None
    completed_at: datetime
    public_summary: str
    checklist: list[PublishedChecklist]
    reports: list[PublishedReport]
    photos: list[PublishedPhoto]


class WorkAcceptance(BaseModel):
    revision: int
    signer_name: str
    accepted_at: datetime
    statement_version: str


class PublishedWork(BaseModel):
    id: int
    revision: int
    manifest_hash: str
    published_at: datetime
    manifest: WorkManifest
    acceptance: WorkAcceptance | None
    previous_acceptances: list[WorkAcceptance] = Field(default_factory=list)


class PublishedWorkPage(BaseModel):
    items: list[PublishedWork]
    has_more: bool


class WorkAcceptancePage(BaseModel):
    items: list[WorkAcceptance]
    has_more: bool


class RevokeTaskPart(BaseModel):
    expected_revision: int = Field(ge=1)
    confirmed: bool = Field(strict=True)
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def explicit_withdrawal(self):
        if not self.confirmed:
            raise ValueError("Confirma la retirada del parte del portal.")
        return self


class CandidateTask(BaseModel):
    id: int
    title: str
    location_id: int
    location_name: str
    client_name: str | None
    status: str
    timezone: str
    scheduled_start_at: datetime | None
    started_at: datetime | None
    completed_at: datetime | None


class CandidateChecklist(PublishedChecklist):
    id: int


class CandidateReport(PublishedReport):
    id: int
    has_photo: bool


class TaskPublicationCandidate(BaseModel):
    task: CandidateTask
    checklist_items: list[CandidateChecklist]
    reports: list[CandidateReport]
    reports_has_more: bool
    source_hash: str
    can_publish: bool
    blocked_reason: str | None
    latest_revision: int
    is_public: bool
    latest: PublishedWork | None
