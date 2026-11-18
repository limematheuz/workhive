import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type Vehicle = {id:number;name:string;registration:string;odometer:string;status:string;service_due_on:string|null};
export type ResourceLog = {
    staff:{id:number;name:string}[];
    vehicles:Vehicle[];
    journeys:{id:number;vehicle_id:number;employee_id:number;location_id:number;start_km:string;end_km:string;starts_at:string;ends_at:string;notes:string}[];
    custody:{id:number;equipment_id:number;employee_id:number;delivered_at:string;returned_at:string|null;notes:string}[];
};
export async function readResourceLog():Promise<ResourceLog> {
    const response = await apiFetch("/api/v1/resource-log",{cache:"no-store"});
    await assertApiResponseOk(response,"No se pudieron cargar los recursos.");
    return response.json();
}
export async function writeResourceLog(path:string,body:object,method="POST") {
    const response = await apiFetch("/api/v1/resource-log/"+path,{method,body:JSON.stringify(body)});
    await assertApiResponseOk(response,"No se pudo guardar el recurso.");
    return response.json();
}
