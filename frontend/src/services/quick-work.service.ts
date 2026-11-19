import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type QuickChoices={people:{id:number;name:string;position:string}[];crews:{id:number;name:string}[];can_create_address:boolean};
export type QuickLocation={id:number;name:string;address:string;city:string;client_id:number|null};
export type QuickWorkInput={title:string;location_id?:number;client_id?:number;address?:string;city?:string;postal_code?:string;save_location?:boolean;service_id?:number;scheduled_start_at:string;duration_minutes:number;employee_ids:number[];crew_id?:number;tasks:string[];instructions:string;price?:string};
async function read<T>(path:string,body?:unknown):Promise<T>{const response=await apiFetch("/api/v1/quick-work"+path,body?{method:"POST",body:JSON.stringify(body)}:{cache:"no-store"});await assertApiResponseOk(response,"No se pudo consultar o guardar el trabajo.");return response.json();}
export const quickWorkChoices=(locationId?:number)=>read<QuickChoices>("/choices"+(locationId?"?location_id="+locationId:""));
export const searchWorkLocations=(query:string)=>read<QuickLocation[]>("/locations?q="+encodeURIComponent(query));
export const createQuickWork=(data:QuickWorkInput)=>read<{task_id:number;location_id:number;temporary_address:boolean}>("",data);
