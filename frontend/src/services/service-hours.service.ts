import { apiFetch, assertApiResponseOk } from "@/lib/api";
export type ServiceHours = {id:number;title:string;planned_minutes:number|null;contract_minutes:number|null;worked_seconds:number;approved_seconds:number|null;can_close:boolean;signature:string};
const base="/api/v1/service-hours";
export async function readServiceHours(offset:number):Promise<{items:ServiceHours[];has_more:boolean}> {
    const response=await apiFetch(base+"?offset="+offset,{cache:"no-store"});
    await assertApiResponseOk(response,"No se pudieron cargar las horas.");
    return response.json();
}
export async function changeServiceHours(id:number, action:"approval"|"contract",body:{minutes:number}|{signature:string}){
    const response=await apiFetch(base+"/"+id+"/"+action,{method:action==="approval"?"POST":"PUT",body:JSON.stringify(body)});
    await assertApiResponseOk(response,"No se pudo guardar la revisión.");
}

export function approvedHoursExportHref(month:string) {
    return base + "/approved-export?month=" + encodeURIComponent(month);
}
