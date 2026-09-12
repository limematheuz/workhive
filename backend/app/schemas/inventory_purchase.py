"""API contracts for purchases that join expenses and stock receipts."""

from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.inventory import _TrimmedTextModel


class InventoryPurchaseLineCreate(_TrimmedTextModel):
    material_id: int = Field(gt=0)
    warehouse_id: int = Field(gt=0)
    quantity: Decimal = Field(gt=0, max_digits=14, decimal_places=3)
    unit_cost: Decimal = Field(ge=0, max_digits=14, decimal_places=4)
    lot_code: str | None = Field(default=None, min_length=1, max_length=120)
    lot_expires_at: date | None = None

    @model_validator(mode="after")
    def require_lot_code_for_expiry(self):
        if self.lot_expires_at is not None and not self.lot_code:
            raise ValueError("La caducidad requiere un código de lote")
        return self


class InventoryPurchaseCreate(_TrimmedTextModel):
    supplier_id: int = Field(gt=0)
    expense_date: datetime
    client_id: int | None = Field(default=None, gt=0)
    category: str = Field(default="supplies", min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=255)
    payment_method: str | None = Field(default=None, max_length=60)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    receipt_url: str | None = None
    reference: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=10_000)
    lines: list[InventoryPurchaseLineCreate] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def require_one_line_per_material_warehouse_and_lot(self):
        locations = {
            (line.material_id, line.warehouse_id, line.lot_code) for line in self.lines
        }
        if len(locations) != len(self.lines):
            raise ValueError(
                "Cada material solo puede aparecer una vez por almacén y lote en una compra"
            )
        return self


class InventoryPurchaseReversal(_TrimmedTextModel):
    reason: str = Field(min_length=1, max_length=1_000)


class InventoryPurchaseExpenseResponse(BaseModel):
    id: int
    expense_date: datetime
    client_id: int | None
    vendor: str | None
    category: str
    description: str
    payment_method: str | None
    base_amount: float
    tax_amount: float
    total_amount: float
    receipt_url: str | None
    notes: str | None
    is_active: bool

    model_config = ConfigDict(from_attributes=True)


class InventoryPurchaseLineResponse(BaseModel):
    id: int
    material_id: int
    warehouse_id: int
    movement_id: int
    lot_id: int | None
    quantity: Decimal
    unit_cost: Decimal

    model_config = ConfigDict(from_attributes=True)


class InventoryPurchaseResponse(BaseModel):
    id: int
    supplier_id: int
    expense_id: int
    status: str
    supplier_name_snapshot: str
    supplier_tax_id_snapshot: str | None
    reference: str | None
    notes: str | None
    created_by_user_id: int | None
    received_at: datetime
    reversed_at: datetime | None
    reversed_by_user_id: int | None
    reversal_reason: str | None
    expense: InventoryPurchaseExpenseResponse
    lines: list[InventoryPurchaseLineResponse]

    model_config = ConfigDict(from_attributes=True)
