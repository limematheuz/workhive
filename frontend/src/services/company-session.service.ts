import { apiFetch, assertApiResponseOk } from "@/lib/api";

export type SessionCompany = { id: number; name: string; access_class: "admin" | "responsible" | "worker" | null; disabled: boolean; disabled_reason: string | null };
export type CompanySessionWorkspace = { current_company_id: number | null; companies: SessionCompany[] };
export const companySession = {
    async list(): Promise<CompanySessionWorkspace> {
        const response = await apiFetch("/api/v1/session/companies", { cache: "no-store" });
        await assertApiResponseOk(response, "No se pudieron consultar tus empresas autorizadas.");
        return response.json();
    },
    async change(companyId: number): Promise<{ company_id: number; company_name: string; csrf_token: string; landing_path: string }> {
        const response = await apiFetch("/api/v1/session/company", { method: "POST", body: JSON.stringify({ company_id: companyId }) });
        await assertApiResponseOk(response, "No se pudo cambiar de empresa. Revisa la membresía y la jornada activa.");
        return response.json();
    },
};
