import type { QualityLocationOption, QualityTab, QualityWorkspaceAccess } from "@/types/quality-access";
export type { QualityTab } from "@/types/quality-access";

const sections: Array<{ id: QualityTab; label: string }> = [
    { id: "templates", label: "Plantillas" },
    { id: "inspections", label: "Inspecciones" },
    { id: "incidents", label: "Incidencias" },
    { id: "complaints", label: "Reclamaciones" },
];

function normalizeScope(scope: number[] | null | undefined): number[] | null {
    return scope === null ? null : Array.isArray(scope)
        ? [...new Set(scope.filter(id => Number.isInteger(id) && id > 0))] : [];
}

function intersectScopes(read: number[] | null, manage: number[] | null): number[] | null {
    if (read === null) return manage;
    if (manage === null) return read;
    const readable = new Set(read);
    return manage.filter(id => readable.has(id));
}

export function getQualityWorkspaceAccess(payload: QualityWorkspaceAccess | null) {
    const read = { templates: false, inspections: false, incidents: false, complaints: false };
    const manage = { ...read };
    const readScopes: Record<QualityTab, number[] | null> = { templates: [], inspections: [], incidents: [], complaints: [] };
    const manageScopes = { ...readScopes };
    for (const { id } of sections) {
        const scope = payload?.sections?.[id];
        readScopes[id] = scope?.can_read === true ? normalizeScope(scope.read_locations) : [];
        manageScopes[id] = scope?.can_manage === true ? intersectScopes(readScopes[id], normalizeScope(scope.manage_locations)) : [];
        read[id] = readScopes[id] === null || readScopes[id].length > 0;
        manage[id] = read[id] && (manageScopes[id] === null || manageScopes[id].length > 0);
    }
    return {
        read, manage,
        tabs: sections.filter(({ id }) => read[id]),
        readLocations: payload?.can_read_locations === true,
        readScopes, manageScopes,
    };
}

export function canManageQualityLocation(access: ReturnType<typeof getQualityWorkspaceAccess>, section: QualityTab, locationId: number | null): boolean {
    const scope = access.manageScopes[section];
    return access.manage[section] && (locationId === null ? scope === null : scope === null || scope.includes(locationId));
}

export function getQualityCreationLocations(access: ReturnType<typeof getQualityWorkspaceAccess>, section: QualityTab,
    locations: QualityLocationOption[], recordLocationIds: Array<number | null>): QualityLocationOption[] {
    const options = new Map<number, QualityLocationOption>();
    for (const location of locations) {
        if (canManageQualityLocation(access, section, location.id)) options.set(location.id, location);
    }
    const knownIds = new Set([...recordLocationIds, ...(access.readScopes[section] ?? []), ...(access.manageScopes[section] ?? [])]);
    for (const id of knownIds) {
        if (id !== null && !options.has(id) && canManageQualityLocation(access, section, id)) options.set(id, { id, name: `Ubicación #${id}` });
    }
    return [...options.values()];
}
