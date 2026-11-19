import { apiFetch, assertApiResponseOk } from "@/lib/api";
export type AbsenceDraft = { employee_id:number; substitute_id:number|null; starts_on:string; ends_on:string; kind:string };
export type Absence = AbsenceDraft & {id:number};
const path="/api/v1/staff-absences";
export async function readAbsences():Promise<Absence[]> {
    const response=await apiFetch(path,{cache:"no-store"});
    await assertApiResponseOk(response,"No se pudieron leer las ausencias.");
    return response.json();
}
export async function saveAbsence(draft:AbsenceDraft,id:number|null):Promise<Absence>{
    const response=await apiFetch(id?path+"/"+id:path,{method:id?"PUT":"POST",body:JSON.stringify(draft)});
    await assertApiResponseOk(response,"No se pudo guardar la ausencia.");
    return response.json();
}
