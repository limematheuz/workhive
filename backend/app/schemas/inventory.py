"""API contracts for the first inventory domain slice."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


InventoryUnit = Literal["unit", "liter", "kilogram", "box", "package"]
InventoryMovementType = Literal["receipt", "issue", "adjustment_in", "adjustment_out"]


class _TrimmedTextModel(BaseModel):
    @field_validator("*", mode="before")
    @classmethod
    def trim_text(cls, value):
        return value.strip() if isinstance(value, str) else value


class InventorySupplierCreate(_TrimmedTextModel):
    name: str = Field(min_length=1, max_length=160)
    tax_id: str | None = Field(default=None, max_length=32)
    contact_name: str | None = Field(default=None, max_length=160)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=32)
    notes: str | None = Field(default=None, max_length=10_000)


class InventorySupplierResponse(InventorySupplierCreate):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryMaterialCreate(_TrimmedTextModel):
    sku: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=10_000)
    unit: InventoryUnit = "unit"
    supplier_id: int | None = Field(default=None, gt=0)
    reorder_point: Decimal = Field(
        default=Decimal("0"), ge=0, max_digits=14, decimal_places=3
    )


class InventoryMaterialResponse(InventoryMaterialCreate):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryWarehouseCreate(_TrimmedTextModel):
    name: str = Field(min_length=1, max_length=160)
    address: str | None = Field(default=None, max_length=255)


class InventoryWarehouseResponse(InventoryWarehouseCreate):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryMovementCreate(_TrimmedTextModel):
    material_id: int = Field(gt=0)
    warehouse_id: int = Field(gt=0)
    lot_id: int | None = Field(default=None, gt=0)
    movement_type: InventoryMovementType
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    unit_cost: Decimal | None = Field(
        default=None, ge=0, max_digits=14, decimal_places=4
    )
    reference: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=10_000)


class InventoryMovementResponse(InventoryMovementCreate):
    id: int
    lot_id: int | None
    work_order_id: int | None
    client_id: int | None
    reversal_of_movement_id: int | None
    recorded_by_user_id: int | None
    created_at: datetime
    material_name: str | None = None
    warehouse_name: str | None = None
    lot_code: str | None = None

    model_config = ConfigDict(from_attributes=True)


class InventoryStockBalance(BaseModel):
    material_id: int
    material_sku: str
    material_name: str
    unit: InventoryUnit
    warehouse_id: int
    warehouse_name: str
    available_quantity: Decimal
    reorder_point: Decimal
    is_below_reorder_point: bool


class InventoryLotResponse(BaseModel):
    id: int
    material_id: int
    material_sku: str
    material_name: str
    warehouse_id: int
    warehouse_name: str
    code: str
    expires_at: date | None
    available_quantity: Decimal
    created_at: datetime


class InventoryWorkOrderConsumptionCreate(_TrimmedTextModel):
    material_id: int = Field(gt=0)
    warehouse_id: int = Field(gt=0)
    lot_id: int | None = Field(default=None, gt=0)
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    notes: str | None = Field(default=None, max_length=10_000)


class InventoryWorkOrderConsumptionReversal(_TrimmedTextModel):
    reason: str = Field(min_length=1, max_length=1_000)
