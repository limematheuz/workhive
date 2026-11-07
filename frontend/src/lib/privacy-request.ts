export function buildPrivacyResolutionPayload(
    decision: "complete" | "reject",
    resolutionNotes: string,
) {
    return {
        decision,
        resolution_notes: resolutionNotes.trim(),
    };
}

const REQUEST_TYPE_LABELS = {
    access: ["Acceso", "Access"],
    rectification: ["Rectificación", "Rectification"],
    erasure: ["Supresión", "Erasure"],
    restriction: ["Limitación del tratamiento", "Restriction of processing"],
    portability: ["Portabilidad", "Portability"],
    objection: ["Oposición", "Objection"],
} as const;

export function getPrivacyRequestTypeLabel(type: string, isSpanish: boolean): string {
    if (!Object.hasOwn(REQUEST_TYPE_LABELS, type)) {
        return isSpanish ? "Solicitud de privacidad" : "Privacy request";
    }
    return REQUEST_TYPE_LABELS[type as keyof typeof REQUEST_TYPE_LABELS][isSpanish ? 0 : 1];
}
