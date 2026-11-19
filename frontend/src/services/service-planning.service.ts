import {apiFetch,assertApiResponseOk} from "@/lib/api";
import type {WorkOrder,WorkOrderCreate} from "@/types/work-order";
export type SpaceAllocation={space_id:number;task_ids:number[];employee_ids:number[];crew_id:number|null;planned_minutes?:number|null};
export type WorkCrew={id:number;name:string;description:string;leader_employee_id:number|null;employee_ids:number[];is_active:boolean};
export type WorkforceChoices={people:{id:number;name:string;position:string;state:string}[];crews:{id:number;name:string;employee_ids:number[]}[]};
export type PlannedService={work_order:WorkOrder;task_id:number|null;space_count:number};
export async function planningRequest<T>(path:string,body?:unknown,method="POST"):Promise<T>{
 const response=await apiFetch("/api/v1/"+path,body?{method,body:JSON.stringify(body)}:{cache:"no-store"});
 await assertApiResponseOk(response,"No se pudo guardar o consultar la planificación.");return response.json();
}
export const workforceChoices=(location:number)=>planningRequest<WorkforceChoices>("service-planning/choices?location_id="+location);
export const createServicePlan=(work_order:WorkOrderCreate,spaces:SpaceAllocation[],generate_first=true,execution_count?:number)=>planningRequest<PlannedService>("service-planning",{work_order,spaces,generate_first,execution_count});

export type ContractSpaceScope={spaces:SpaceAllocation[];occurrences:number|null;remaining_occurrences:number|null};
export const contractSpaceScope=(contract:number,location:number)=>planningRequest<ContractSpaceScope>(`service-planning/contract-scope?contract_id=${contract}&location_id=${location}`);
