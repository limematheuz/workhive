import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type CostInputs={labor_hours:string;hourly_cost:string;materials:string;other_costs:string};
export type QuoteCosts={revision:number;revenue:string;cost:string|null;margin:string|null;labor_amount:string|null;estimate:CostInputs|null};
export async function quoteCosts(id:number,input?:CostInputs&{revision:number}):Promise<QuoteCosts>{
    const response=await apiFetch("/api/v1/quote-cost-estimates/"+id,input?{method:"PUT",body:JSON.stringify(input)}:{cache:"no-store"});
    await assertApiResponseOk(response,"No se pudo consultar o guardar la previsión.");
    return response.json();
}
