import type { PortalAccess } from "@/services/portal-workspace.service";
const labels: Record<PortalAccess["status"] | "pending", string> = {
    active: "Activo", revoked: "Revocado", suspended: "Cuenta suspendida", expired: "Caducado", pending: "Pendiente",
};
export function PortalAccessStatus({ status }: {
    status: PortalAccess["status"] | "pending";
}) {
    const tone = status === "active"
        ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
        : status === "revoked"
            ? "bg-muted text-muted-foreground"
            : "bg-orange-50 text-orange-800 dark:bg-orange-950 dark:text-orange-200";
    return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${tone}`}>{labels[status]}</span>;
}
