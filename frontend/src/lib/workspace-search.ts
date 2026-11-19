export const SEARCH_TYPES = ["clients", "locations", "tasks", "invoices", "quotes", "staff", "reports", "time", "incidents"] as const;
export type WorkspaceSearchType = typeof SEARCH_TYPES[number];
export type WorkspaceSearchItem = {
    key: string; type: WorkspaceSearchType | "navigation"; id: number | null;
    title: string; context: string; status: string | null; reference: string | null; href: string;
};
export type WorkspaceSearchResult = {
    query: string; company_id: number; context_key: string; available_types: WorkspaceSearchType[];
    groups: { type: WorkspaceSearchType; label: string; items: WorkspaceSearchItem[]; has_more: boolean }[];
    navigation: WorkspaceSearchItem[];
};

/** Search destinations are local product routes, never API or external URLs. */
export function isWorkspaceSearchHref(href: string): boolean {
    if (!href.startsWith("/") || href.startsWith("//") || /[\\\r\n]/.test(href)) return false;
    try {
        const url = new URL(href, "https://workhive.invalid");
        return url.origin === "https://workhive.invalid" && !url.hash &&
            /^\/(?:worker\/clock|dashboard(?:\/(?:clients|locations|tasks|plantilla\/trabajadores|task-reports|quality|invoices(?:\/[1-9]\d*)?|quotes(?:\/[1-9]\d*)?))?)$/.test(url.pathname);
    } catch { return false; }
}

export function searchResultCount(result: WorkspaceSearchResult): number {
    return result.groups.reduce((total, group) => total + group.items.length, 0) + result.navigation.length;
}

export function searchStatusLabel(status: string): string {
    const labels: Record<string, string> = {
        pending: "Pendiente", in_progress: "En curso", completed: "Completado", done: "Completado",
        open: "Abierta", resolved: "Resuelta", active: "Activo", inactive: "Inactivo", draft: "Borrador",
        sent: "Enviado", accepted: "Aceptado", rejected: "Rechazado", expired: "Caducado", paid: "Cobrada",
        partially_paid: "Cobro parcial", overdue: "Vencida", cancelled: "Cancelado", review: "En revisión",
        pending_review: "Pendiente de revisión", scheduled: "Programado", approved: "Aprobado", closed: "Cerrado",
    };
    return labels[status] ?? status.replaceAll("_", " ");
}
