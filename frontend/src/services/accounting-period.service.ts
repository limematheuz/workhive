import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type PeriodSnapshot={month:string;timezone:string;base_currency:string;record_counts:Record<string,number>;amounts:Record<string,string>;draft_invoices:number;uncosted_stock_movements:number;fingerprint:string;captured_at:string};
export type AccountingPeriod={month:string;status:"open"|"closed";revision:number;closed_at:string|null;reopened_at:string|null;snapshot:PeriodSnapshot|null;current:PeriodSnapshot|null;access:{can_close:boolean;can_reopen:boolean};history:{id:number;action:"closed"|"reopened";revision:number;reason:string;actor_id:number|null;created_at:string;snapshot:PeriodSnapshot|null}[]};
export async function accountingPeriod(company:number,month:string,decision?:{action:"close"|"reopen";reason:string;expected_revision:number}):Promise<AccountingPeriod>{
 const path="/api/v1/accounting-periods/"+company+"/"+encodeURIComponent(month)+(decision?"/"+decision.action:"");
 const response=await apiFetch(path,decision?{method:"POST",body:JSON.stringify({reason:decision.reason,expected_revision:decision.expected_revision})}:{cache:"no-store"});
 await assertApiResponseOk(response,"No se pudo consultar o cambiar el periodo contable.");return response.json();
}
