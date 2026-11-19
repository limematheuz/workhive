import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type AdvisoryRequest={id:number;area:"accounting"|"payroll";description:string;response:string|null;created_at:string;answered_at:string|null};
export async function advisoryRequests(company:number,body?:unknown,id?:number):Promise<AdvisoryRequest[]|AdvisoryRequest>{
 const response=await apiFetch("/api/v1/advisory-requests/"+company+(id?"/"+id:""),body?{method:id?"PUT":"POST",body:JSON.stringify(body)}:{cache:"no-store"});
 await assertApiResponseOk(response,"No se pudo gestionar la petición.");return response.json();
}
export async function deliverPayroll(company:number,employee:number,month:string,file:File){
 const form=new FormData();form.append("file",file);
 const response=await apiFetch(`/api/v1/advisory/${company}/staff/${employee}/payroll?month=${encodeURIComponent(month)}`,{method:"POST",body:form});
 await assertApiResponseOk(response,"No se pudo entregar la nómina.");
}
