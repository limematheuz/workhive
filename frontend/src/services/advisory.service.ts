import {apiFetch, assertApiResponseOk} from "@/lib/api";
export type AdvisoryCompany = {id:number; name:string; accounting:boolean; payroll:boolean};
export type AdvisoryGrant = {email:string; accounting:boolean; payroll:boolean; can_close_periods?:boolean; status:string};
export type Payroll = {
    variables:{id:number;employee_id:number;kind:string;amount:string;description:string;starts_on:string}[];
    staff: {id:number; name:string; position:string; monthly_hours:string; hourly_cost:string; profile: {documents?:{name:string;url:string}[]}}[];
    absences: {employee_id:number; substitute_id:number|null; starts_on:string; ends_on:string; kind:string}[];
};
export async function readAdvisory<T>(path:string):Promise<T> {
    const response = await apiFetch("/api/v1/advisory/" + path, {cache:"no-store"});
    await assertApiResponseOk(response, "No se pudo cargar la gestoría.");
    return response.json();
}
export async function saveAdvisoryGrant(body:Omit<AdvisoryGrant,"status">):Promise<AdvisoryGrant[]> {
    const response = await apiFetch("/api/v1/advisory/grants", {method:"PUT", body:JSON.stringify(body)});
    await assertApiResponseOk(response, "No se pudo cambiar el acceso.");
    return response.json();
}
export function advisoryExportHref(company:number, year:number, month?:string) {
    const path = month ? "/payroll-export?month=" + encodeURIComponent(month) : "/accounting?year=" + year;
    return "/api/v1/advisory/" + company + path;
}
