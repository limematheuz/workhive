import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type { ClientOpportunity, ClientOpportunityStage } from "@/types/client";
export type CommercialAccount = {
    id: number;
    name: string;
    relationship_status: "lead" | "client";
};
export type CommercialOpportunity = ClientOpportunity & {
    client_name: string;
    relationship_status: "lead" | "client";
    linked_quotes: {
        id: number;
        number: string;
        status: string;
    }[];
};
export type CommercialWorkspace = {
    timezone: string;
    items: CommercialOpportunity[];
    has_more: boolean;
    summary: {
        stages: Record<ClientOpportunityStage, number>;
        overdue: number;
        unscheduled: number;
        leads: number;
        win_rate: number | null;
    };
    access: {
        can_manage: boolean;
        can_create_account: boolean;
        can_view_quotes: boolean;
        can_calculate: boolean;
    };
};
export async function readCommercialWorkspace(query: {
    search: string;
    stage: string;
    attention: boolean;
    offset: number;
}): Promise<CommercialWorkspace> {
    const params = new URLSearchParams({ search: query.search, attention: String(query.attention), offset: String(query.offset) });
    if (query.stage)
        params.set("stage", query.stage);
    const response = await apiFetch("/api/v1/commercial-workspace?" + params, { cache: "no-store" });
    await assertApiResponseOk(response, "No se pudo cargar el seguimiento comercial.");
    return response.json();
}
export async function searchCommercialAccounts(search: string): Promise<CommercialAccount[]> {
    const response = await apiFetch("/api/v1/commercial-workspace/accounts?" + new URLSearchParams({ search }), { cache: "no-store" });
    await assertApiResponseOk(response, "No se pudieron buscar clientes o leads.");
    return response.json();
}
