import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type ReportKind="work"|"staff"|"quality";
export type ReportInput={name:string;kind:ReportKind;columns:string[];starts_on:string;ends_on:string;location_id:number|null};
export type SavedReport=ReportInput&{id:number};
export type ReportResult={timezone:string;columns:{key:string;label:string}[];rows:Record<string,string|number|null>[];has_more:boolean};
const base="/api/v1/custom-reports";
export async function reportRequest<T>(path="",body?:unknown,method="POST"):Promise<T>{
 const response=await apiFetch(base+path,body?{method,body:JSON.stringify(body)}:method==="DELETE"?{method}:{cache:"no-store"});
 await assertApiResponseOk(response,"No se pudo gestionar el informe.");return response.status===204?undefined as T:response.json();
}
export const reportExportHref=(id:number,offset:number)=>base+"/"+id+"/export?offset="+offset;
export const reportColumns:Record<ReportKind,Record<string,string>>={
 work:{id:"ID",title:"Título",location:"Ubicación",status:"Estado",scheduled:"Programado",completed:"Finalizado",checklist_done:"Tareas hechas",checklist_total:"Tareas totales"},
 staff:{id:"ID",name:"Nombre",position:"Cargo",team:"Equipo",status:"Estado",monthly_hours:"Horas al mes",hourly_cost:"Coste por hora EUR"},
 quality:{id:"ID",title:"Título",location:"Ubicación",status:"Estado",severity:"Gravedad",created:"Creada",resolved:"Resuelta"},
};
