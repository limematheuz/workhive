import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type Consolidation = {currency:string;revenue:string;cost:string;margin:string;companies:{company_id:number;name:string;revenue:string;cost:string;margin:string}[]};
export type RegionalSettings = {company_id:number;parent_company_id:number|null;country:string;language:"es"|"en";timezone:string;currency:string};
export async function readConsolidation<T>(path:string):Promise<T> {
    const response=await apiFetch("/api/v1/consolidation/"+path,{cache:"no-store"});
    await assertApiResponseOk(response,"No se pudo cargar la información.");
    return response.json();
}
export async function saveConsolidation<T>(path:string,body:object,method="POST"):Promise<T> {
    const response=await apiFetch("/api/v1/consolidation/"+path,{method,body:JSON.stringify(body)});
    await assertApiResponseOk(response,"No se pudo guardar el informe.");
    return response.json();
}
