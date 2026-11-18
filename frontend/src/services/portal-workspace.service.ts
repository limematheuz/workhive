import { apiFetch, assertApiResponseOk } from "@/lib/api";
export type PortalAccess = {
    id: number;
    email: string;
    name: string | null;
    status: "active" | "revoked" | "suspended" | "expired";
    expires_at: string | null;
};
export type PortalAccount = {
    id: number;
    name: string;
    grants: PortalAccess[];
    invitations: {
        id: number;
        email: string;
        status: "pending" | "expired";
        expires_at: string;
    }[];
};
export type PortalWorkspace = {
    clients: PortalAccount[];
    has_more: boolean;
    advisers: (PortalAccess & {
        accounting: boolean;
        payroll: boolean;
    })[];
    summary: {
        active_client_accesses: number;
        pending_invitations: number;
    };
    modules: {
        client_portal: boolean;
        advisory: boolean;
        worker_app: boolean;
    };
    invitation_delivery_configured: boolean;
    can_manage_client_invitations: boolean;
};
export async function readPortalWorkspace(search: string, offset: number): Promise<PortalWorkspace> {
    const query = new URLSearchParams({ search, offset: String(offset) });
    const response = await apiFetch("/api/v1/portal-workspace?" + query, { cache: "no-store" });
    await assertApiResponseOk(response, "No se pudieron cargar los portales de la empresa.");
    return response.json();
}
