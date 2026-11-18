import {apiFetch, assertApiResponseOk} from "@/lib/api";
export type StaffShift = {
    id:number; employee_id:number; location_id:number; task_id:number|null;
    starts_at:string; ends_at:string; effective_employee_id:number|null; coverage:string;
};
export async function readStaffShifts():Promise<StaffShift[]> {
    const response = await apiFetch("/api/v1/staff-shifts",{cache:"no-store"});
    await assertApiResponseOk(response,"No se pudieron cargar los turnos.");
    return response.json();
}
export async function saveStaffShift(id:number|null, body:object) {
    const response = await apiFetch("/api/v1/staff-shifts" + (id ? "/" + id : ""), {method:id ? "PUT" : "POST", body:JSON.stringify(body)});
    await assertApiResponseOk(response,"No se pudo guardar el turno.");
    return response.json();
}
