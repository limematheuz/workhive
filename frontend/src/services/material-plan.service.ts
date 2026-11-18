import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type MaterialPlan={material_id:number;name:string;unit:string;planned:string|null;used:string};
export async function materialPlans(order:number,input?:{material_id:number;quantity:string}):Promise<MaterialPlan[]>{
 const response=await apiFetch("/api/v1/material-plans/"+order,input?{method:"PUT",body:JSON.stringify(input)}:{cache:"no-store"});
 await assertApiResponseOk(response,"No se pudo cargar o guardar la previsión de materiales.");return response.json();
}
