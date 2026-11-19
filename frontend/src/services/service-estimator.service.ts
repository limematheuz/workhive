import {apiFetch,assertApiResponseOk} from "@/lib/api";
import type {LocationSpace} from "@/types/location";
import type {SpaceAllocation,WorkforceChoices} from "@/services/service-planning.service";
export type EstimateMaterial={ui_key?:string;material_id:number;warehouse_id:number;quantity:string};
export type EstimateInput={location_id:number;spaces:SpaceAllocation[];materials:EstimateMaterial[];other_costs:string;target_margin_percent:string;occurrences:number;tax_rate:string};
export type EstimateOptions={locations:{id:number;name:string;location_type:string;client_id:number|null}[];opportunity:{id:number;title:string;client_id:number}|null;spaces:LocationSpace[];choices:WorkforceChoices;materials:{id:number;name:string;unit:string}[];warehouses:{id:number;name:string}[];inventory_available:boolean};
export type LaborSource={space_id:number;space:string;employee_id:number;employee:string;minutes:number|null;hourly_cost:string|null;cost:string|null;cost_source:string;duration_source:string};
export type MaterialSource={material_id:number;material:string;warehouse_id:number;warehouse:string;unit:string;quantity:string;available_quantity:string;unit_cost:string|null;cost:string|null};
export type EstimatePreview={location_id:number;location:string;client_id:number|null;labor:LaborSource[];materials:MaterialSource[];labor_minutes:number;labor_hours:string;labor_cost:string|null;material_cost:string|null;known_labor_cost:string;known_material_cost:string;other_costs:string;known_cost:string;total_cost:string|null;suggested_unit_price:string|null;occurrences:number;total_price:string|null;total_tax:string|null;target_margin_percent:string;actual_margin_percent:string|null;missing:string[];warnings:string[];can_save:boolean;fingerprint:string;historical:{available:boolean;sample_count:number;costed_sample_count:number;average_person_hours:string|null;average_labor_cost:string|null;note:string}};
async function request<T>(path:string,body?:unknown):Promise<T>{
 const response=await apiFetch("/api/v1/service-estimator/"+path,body?{method:"POST",body:JSON.stringify(body)}:{cache:"no-store"});
 await assertApiResponseOk(response,"No se pudo calcular o guardar el presupuesto.");return response.json();
}
export function estimateOptions(location?:number,opportunity?:number){const query=new URLSearchParams();if(location)query.set("location_id",String(location));if(opportunity)query.set("opportunity_id",String(opportunity));return request<EstimateOptions>("options?"+query);}
function wireInput(input:EstimateInput){return {...input,materials:input.materials.map(({material_id,warehouse_id,quantity})=>({material_id,warehouse_id,quantity}))};}
export const previewEstimate=(input:EstimateInput)=>request<EstimatePreview>("preview",wireInput(input));
export const saveEstimate=(input:EstimateInput,title:string,fingerprint:string,opportunity?:number)=>request<{quote_id:number;quote_number:string;total_amount:string;cost:string}>("quotes",{...wireInput(input),title,expected_fingerprint:fingerprint,opportunity_id:opportunity??null});
