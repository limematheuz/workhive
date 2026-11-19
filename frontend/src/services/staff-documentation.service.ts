import {apiFetch,assertApiResponseOk} from "@/lib/api";
export type StaffDocument = {
    employee_id:number;employee:string;name:string;url:string;digest:string;expires_on:string|null;
    expired:boolean;acknowledged_at:string|null;document_type:string;version:string;
};
export async function readStaffDocumentation(own:boolean):Promise<StaffDocument[]> {
    const response=await apiFetch("/api/v1/staff-documentation?own="+own,{cache:"no-store"});
    await assertApiResponseOk(response,"No se pudo cargar la documentación.");
    return response.json();
}
export async function acknowledgeStaffDocument(digest:string) {
    const response=await apiFetch("/api/v1/staff-documentation/"+digest+"/acknowledge",{method:"POST"});
    await assertApiResponseOk(response,"No se pudo confirmar la recepción.");
}
