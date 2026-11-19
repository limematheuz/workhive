import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type { QualificationCode } from "@/domain/staff/staff-availability";
import type { Absence } from "./staff-absence.service";
export type SubstituteSearch = { location_id: number; starts_at: string; ends_at: string; required_training_codes: QualificationCode[]; absence_id: number; offset?: number };
export type SubstituteResults = { items: { id: number; name: string; position: string; state: string; eligible: boolean; reasons: string[] }[]; has_more: boolean; timezone: string };
export async function searchSubstitutes(payload: SubstituteSearch): Promise<SubstituteResults> {
    const response = await apiFetch("/api/v1/staff-absences/candidates/search", { method: "POST", body: JSON.stringify(payload) });
    await assertApiResponseOk(response, "No se pudo consultar la bolsa de sustituciones.");
    return response.json();
}
export async function assignSubstitute(payload: SubstituteSearch & { employee_id: number }): Promise<Absence> {
    const response = await apiFetch("/api/v1/staff-absences/candidates/assign", { method: "POST", body: JSON.stringify(payload) });
    await assertApiResponseOk(response, "No se pudo asignar la cobertura.");
    return response.json();
}
