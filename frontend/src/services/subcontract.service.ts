import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type SubcontractInput={work_order_id:number;supplier_id:number;amount:string;description:string;document_url:string|null;document_expires_on:string|null};
export type Subcontract=SubcontractInput&{id:number;work_order:string;supplier:string;location_id:number;status:"planned"|"progress"|"completed"|"cancelled";expense_id:number|null};
export async function subcontractRequest<T>(path="",body?:unknown,method="POST"):Promise<T>{
 const response=await apiFetch("/api/v1/subcontracts"+path,body?{method,body:JSON.stringify(body)}:{cache:"no-store"});
 await assertApiResponseOk(response,"No se pudo completar la gestión de subcontratas.");return response.json();
}
