import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type InternalRequest={purchase_id?:number|null;purchase_approval_id?:number|null;id:number;employee_id:number;kind:string;description:string;starts_on:string;ends_on:string;amount:string;status:string;absence_id:number|null};
export type InternalRequestAccess={kinds:string[];can_review:boolean};
export const requestKinds={vacation:"Vacaciones",material:"Material",shift:"Cambio de turno",advance:"Anticipo",purchase:"Compra",extra_hours:"Horas adicionales"};
export async function readInternalRequests<T>(path:string):Promise<T> {
    const response=await apiFetch("/api/v1/internal-requests"+path,{cache:"no-store"});
    await assertApiResponseOk(response,"No se pudieron cargar las solicitudes.");
    return response.json();
}
export const readInternalRequestAccess=()=>readInternalRequests<InternalRequestAccess>("/access");
export async function writeInternalRequest(path:string,body:object) {
    const response=await apiFetch("/api/v1/internal-requests"+path,{method:"POST",body:JSON.stringify(body)});
    await assertApiResponseOk(response,"No se pudo guardar la solicitud.");
    return response.json();
}
