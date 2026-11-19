import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type AccountingRecords={invoices:{id:number;number:string;date:string;status:string;total:string;pdf:string}[];expenses:{id:number;date:string;vendor:string|null;description:string;total:number;receipt:string|null}[];has_more:boolean};
export async function accountingRecords(company:number,month:string,offset:number):Promise<AccountingRecords>{
 const response=await apiFetch(`/api/v1/advisory-accounting/${company}?month=${encodeURIComponent(month)}&offset=${offset}`,{cache:"no-store"});
 await assertApiResponseOk(response,"No se pudo cargar la documentación contable.");return response.json();
}
