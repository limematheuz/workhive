import {apiFetch,assertApiResponseOk} from "@/lib/api";
import type {StaffRoster} from "@/domain/tasks/overview-staff-roster";
export async function staffRoster(start:string,end:string):Promise<StaffRoster[]>{
 const rows:StaffRoster[]=[];
 for(let offset=0;;offset+=500){
  const query=new URLSearchParams({start,end,offset:String(offset)});
  const response=await apiFetch("/api/v1/staff-shifts/roster?"+query,{cache:"no-store"});
  await assertApiResponseOk(response,"No se pudo cargar la plantilla programada.");
  const page=await response.json() as {items:StaffRoster[];has_more:boolean};rows.push(...page.items);if(!page.has_more)return rows;
 }
}
