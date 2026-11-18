import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type SpaceWorker={can_edit:boolean;can_manage:boolean;id:number;space_id:number|null;space_name:string;employee_id:number;employee:string;crew_id:number|null;planned_minutes:number|null;done:number;total:number;tasks:{id:number;title:string;completed:boolean;answer?:string|null}[]};
export async function spaceWorkforce(task:number,allocation?:number,checklist?:number,completed?:boolean,answer?:"yes"|"no"):Promise<SpaceWorker[]>{
 const path="/api/v1/workforce-execution/"+task+(allocation!==undefined?`/${allocation}/${checklist}`:"");
 const response=await apiFetch(path,allocation!==undefined?{method:"PUT",body:JSON.stringify({completed,answer})}:{cache:"no-store"});
 await assertApiResponseOk(response,"No se pudo consultar o actualizar el trabajo por espacios.");return response.json();
}
