export type QualityTab = "templates" | "inspections" | "incidents" | "complaints";

const sections: Array<{ id: QualityTab; label: string }> = [
    { id: "templates", label: "Plantillas" },
    { id: "inspections", label: "Inspecciones" },
    { id: "incidents", label: "Incidencias" },
    { id: "complaints", label: "Reclamaciones" },
];

export function getQualityWorkspaceAccess(capabilities: Record<string, boolean>) {
    const read = { templates: false, inspections: false, incidents: false, complaints: false };
    const manage = { ...read };
    for (const { id } of sections) {
        read[id] = capabilities[`quality.${id}.read`] === true;
        manage[id] = read[id] && capabilities[`quality.${id}.manage`] === true;
    }
    return {
        read, manage,
        tabs: sections.filter(({ id }) => read[id]),
        readLocations: capabilities["locations.read"] === true,
    };
}
