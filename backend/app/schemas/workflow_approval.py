from pydantic import BaseModel,Field,ConfigDict
from typing import Literal
from app.schemas.inventory_purchase import InventoryPurchaseCreate


class ApprovalPolicyInput(BaseModel):
    model_config=ConfigDict(extra="forbid")
    purchases_required:bool
    task_close_required:bool


class PurchaseProposalInput(BaseModel):
    source_request_id:int|None=Field(default=None,ge=1)
    purchase:InventoryPurchaseCreate


class ApprovalDecision(BaseModel):
    model_config=ConfigDict(extra="forbid",str_strip_whitespace=True)
    fingerprint:str=Field(min_length=64,max_length=64)
    decision:Literal["approved","rejected"]
    note:str=Field(default="",max_length=2000)
