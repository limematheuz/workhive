from datetime import date
from decimal import Decimal
from typing import Any,Literal
from pydantic import BaseModel,Field,ConfigDict,model_validator


class CurrencyInput(BaseModel):
    model_config=ConfigDict(extra="forbid",str_strip_whitespace=True)
    currency:str=Field(pattern=r"^[A-Z]{3}$")
    eur_rate:Decimal=Field(gt=0,le=100000000,max_digits=18,decimal_places=8)
    rate_date:date
    rate_verified:Literal[True]
    document:dict[str,Any]
    settle_invoice_id:int|None=Field(default=None,ge=1)
    settled_native_amount:Decimal|None=Field(default=None,gt=0,max_digits=18,decimal_places=6)

    @model_validator(mode="after")
    def settlement_pair(self):
        if (self.settle_invoice_id is None)!=(self.settled_native_amount is None):
            raise ValueError("Indica la factura y el importe original que se liquida.")
        return self


from app.schemas.customer_payment import CustomerPaymentCreate
from app.schemas.sales_ledger import SalesLedgerManualRecordCreate

class NativePayment(CustomerPaymentCreate):
    amount:Decimal=Field(gt=0,max_digits=18,decimal_places=6)

class NativeSale(SalesLedgerManualRecordCreate):
    base_amount:Decimal=Field(ge=0,max_digits=18,decimal_places=6)
    tax_amount:Decimal=Field(ge=0,max_digits=18,decimal_places=6)
