import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type { QualificationCode, WeeklyAvailability } from "@/domain/staff/staff-availability";

import {costLabels,hourly,monthly,type CostKey} from "@/domain/staff/staff-costs";
export {costLabels,hourly,monthly,type CostKey};
export type StaffDocument = {name:string;url:string;expires_on?:string|null;issued_on?:string|null;qualification_code?:QualificationCode|null;document_type?:string;version?:string};
export type Profile = Record<CostKey,string> & {account_email?:string;contract:string;state:string;identifier:string;availability:string;weekly_availability?:WeeklyAvailability[]|null;compatible_location_ids?:number[]|null;documents:StaffDocument[]};
export type Employee = {id:number; history?:Record<string,{cost:string;hours:string}>; name:string; position:string; team:string;monthly_hours:string; hourly_cost:string; profile:Profile};
export function blankEmployee():Employee {
    return {id:0,name:"",position:"",team:"",monthly_hours:"160",hourly_cost:"0",profile:{contract:"Indefinido",state:"Activo",identifier:"",availability:"",documents:[],gross:"0",extra:"0",bonus:"0",insurance:"0",other:"0"}};
}
export const StaffService = {
    async uploadDocument(employeeId:number,file:File):Promise<{name:string;url:string}> {
        const body=new FormData();body.append("file",file);
        const response=await apiFetch("/api/v1/staff-files/"+employeeId,{method:"POST",body});
        await assertApiResponseOk(response,"No se pudo subir el documento.");
        return response.json();
    },
    async list():Promise<Employee[]> {
        const response=await apiFetch("/api/v1/staff",{cache:"no-store"});
        await assertApiResponseOk(response,"No se pudo cargar la plantilla");
        return response.json();
    },
    async save(employee:Employee):Promise<Employee> {
        const profile={...employee.profile,weekly_availability:employee.profile.weekly_availability?.map(({weekday,starts_at,ends_at})=>({weekday,starts_at,ends_at}))??null};
        const response=await apiFetch("/api/v1/staff"+(employee.id ? "/"+employee.id : ""),{method:employee.id ? "PUT":"POST",body:JSON.stringify({...employee,profile,hourly_cost:hourly(employee).toFixed(2)})});
        await assertApiResponseOk(response,"No se pudo guardar la ficha");
        return response.json();
    }
};
