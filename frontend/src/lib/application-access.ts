export const APPLICATION_DESTINATIONS = {
    internal: "/dashboard", worker: "/worker", client: "/portal-cliente", adviser: "/gestoria",
} as const;
export type ApplicationAccessKind = keyof typeof APPLICATION_DESTINATIONS;
export type ApplicationAccess = {
    key: string; kind: ApplicationAccessKind; label: string; description: string;
    company_id: number | null; company_name: string | null; href: string;
};
export type ApplicationWorkspace = {
    current_application: ApplicationAccessKind; current_key?: string | null; applications: ApplicationAccess[];
};
function record(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function applicationKind(value: unknown): value is ApplicationAccessKind {
    return typeof value === "string" && Object.hasOwn(APPLICATION_DESTINATIONS, value);
}
export function readApplicationAccess(value: unknown): ApplicationAccess {
    if (!record(value) || !applicationKind(value.kind)
        || typeof value.key !== "string" || !value.key.trim()
        || typeof value.label !== "string" || !value.label.trim() || typeof value.description !== "string"
        || !(value.company_name === null || typeof value.company_name === "string")
        || !(value.company_id === null || (Number.isSafeInteger(value.company_id) && Number(value.company_id) > 0))
        || ((value.kind === "internal" || value.kind === "worker") && value.company_id === null)
        || value.href !== APPLICATION_DESTINATIONS[value.kind]) {
        throw new Error("El servidor ha devuelto un acceso no válido. Actualiza tus accesos.");
    }
    return { key: value.key, kind: value.kind, label: value.label, description: value.description,
        company_id: value.company_id === null ? null : Number(value.company_id),
        company_name: value.company_name, href: APPLICATION_DESTINATIONS[value.kind] };
}
export function readApplicationWorkspace(value: unknown): ApplicationWorkspace {
    if (!record(value) || !applicationKind(value.current_application) || !Array.isArray(value.applications)
        || !(value.current_key === undefined || value.current_key === null || typeof value.current_key === "string")) {
        throw new Error("No se pudieron interpretar tus accesos. Vuelve a intentarlo.");
    }
    const applications = value.applications.map(readApplicationAccess);
    if (new Set(applications.map(row => row.key)).size !== applications.length) {
        throw new Error("No se pudieron interpretar tus accesos. Vuelve a intentarlo.");
    }
    return { current_application: value.current_application, current_key: value.current_key, applications };
}
export function resolveApplicationSwitchTarget(chosen: ApplicationAccess, value: unknown): string {
    if (!record(value)) throw new Error("No se pudo confirmar el cambio de aplicación.");
    const granted = readApplicationAccess(value.application);
    if (granted.key !== chosen.key || granted.kind !== chosen.kind || granted.company_id !== chosen.company_id
        || value.target_path !== APPLICATION_DESTINATIONS[chosen.kind]) {
        throw new Error("No se pudo confirmar el acceso seleccionado. Actualiza tus accesos.");
    }
    return APPLICATION_DESTINATIONS[chosen.kind];
}
export function isCurrentApplication(workspace: ApplicationWorkspace, row: ApplicationAccess): boolean {
    if (workspace.current_key) return workspace.current_key === row.key;
    return workspace.current_application === row.kind
        && workspace.applications.filter(candidate => candidate.kind === row.kind).length === 1;
}
