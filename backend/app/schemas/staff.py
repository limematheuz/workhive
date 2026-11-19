from decimal import Decimal
from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.schemas.staff_availability import QualificationCode, WeeklyAvailability

class Document(BaseModel):
    issued_on: date | None = None
    qualification_code: QualificationCode | None = None
    expires_on: date | None = None
    document_type: Literal["training","epi","contract","payroll","other"] = "other"
    version: str = Field(default="1",max_length=20)
    name: str = Field(max_length=150)
    url: str = Field(pattern=r"^(https://|/api/v1/staff-files/[0-9]+/download$)", max_length=2048)

    @model_validator(mode="after")
    def valid_training(self):
        if self.issued_on and self.expires_on and self.expires_on < self.issued_on:
            raise ValueError("La caducidad no puede ser anterior a la emisión.")
        if self.qualification_code and self.document_type != "training":
            raise ValueError("La acreditación debe vincularse a un documento de formación.")
        return self


class Profile(BaseModel):
    account_email: str = Field(default="",max_length=255)
    contract: str = Field(default="", max_length=80)
    state: str = Field(default="Activo", max_length=50)
    identifier: str = Field(default="", max_length=12)
    availability: str = Field(default="", max_length=500)
    weekly_availability: list[WeeklyAvailability] | None = Field(default=None, max_length=42)
    compatible_location_ids: list[int] | None = Field(default=None, max_length=500)
    gross: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    extra: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    bonus: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    insurance: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    other: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    documents: list[Document] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def valid_structured_availability(self):
        if self.compatible_location_ids is not None and (
            len(set(self.compatible_location_ids)) != len(self.compatible_location_ids)
            or any(value < 1 for value in self.compatible_location_ids)
        ):
            raise ValueError("Selecciona centros únicos y válidos.")
        occupied = {}
        for row in sorted(self.weekly_availability or [], key=lambda slot: (slot.weekday, slot.starts_at)):
            if row.starts_at < occupied.get(row.weekday, ""):
                raise ValueError("Las franjas de disponibilidad no pueden solaparse.")
            occupied[row.weekday] = row.ends_at
        return self


class EmployeeInput(BaseModel):
    profile: Profile = Field(default_factory=Profile)
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=140)
    position: str = Field(min_length=1, max_length=120)
    team: str = Field(max_length=120)
    monthly_hours: Decimal = Field(ge=0, le=744, decimal_places=2)
    hourly_cost: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class Employee(EmployeeInput):
    model_config = ConfigDict(from_attributes=True)
    id: int
    history: dict[str, dict[str, str]] | None = None
