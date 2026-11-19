import {apiFetch,assertApiResponseOk} from "@/lib/api";
import type {InventoryPurchaseInput} from "@/types/inventory";
export type ApprovalPolicy={purchases_required:boolean;task_close_required:boolean;available:boolean;can_manage:boolean};
export type PurchaseProposal={id:number;status:"pending"|"approved"|"rejected";fingerprint:string;purchase:InventoryPurchaseInput;purchase_id:number|null;note:string;created_at:string;source_request?:ApprovedPurchaseBudget|null};
export type ClosureApproval={available:boolean;task_id:number;required:boolean;status:string;fingerprint:string|null;current_fingerprint:string;note:string;can_request:boolean;can_decide:boolean};
export async function approvalRequest<T>(path:string,body?:unknown,method="POST"):Promise<T>{const response=await apiFetch("/api/v1/workflow-approvals/"+path,body?{method,body:JSON.stringify(body)}:{cache:"no-store"});await assertApiResponseOk(response,"No se pudo consultar o guardar la aprobación.");return response.json();}
export const approvalSettings=()=>approvalRequest<ApprovalPolicy>("policy");
export const saveApprovalSettings=(value:Pick<ApprovalPolicy,"purchases_required"|"task_close_required">)=>approvalRequest<ApprovalPolicy>("policy",{purchases_required:value.purchases_required,task_close_required:value.task_close_required},"PUT");
export const submitPurchaseProposal=(purchase:InventoryPurchaseInput,source_request_id?:number)=>approvalRequest<PurchaseProposal>("purchases",{purchase,source_request_id});

export type ApprovedPurchaseBudget={id:number;description:string;amount:string;status?:string};
export const approvedPurchaseBudgets=()=>approvalRequest<ApprovedPurchaseBudget[]>("source-requests");
export async function purchaseApprovalWorkspace(){const policy=await approvalSettings();return{policy,budgets:policy.available?await approvedPurchaseBudgets():[]};}
