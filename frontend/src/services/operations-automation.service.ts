import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type OperationsAutomation={recurring:boolean;documents:boolean;incidents:boolean;horizon_days:number;last_run:string|null;last_result:string|null};
export async function operationsAutomation(method="GET",body?:object,path=""):Promise<OperationsAutomation> {
    const response=await apiFetch("/api/v1/operations-automation"+path,{method,cache:"no-store",body:body?JSON.stringify(body):undefined});
    await assertApiResponseOk(response,"No se pudo actualizar la automatización.");
    return response.json();
}
