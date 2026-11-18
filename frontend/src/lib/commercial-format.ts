import type { ClientOpportunityStage } from "../types/client.ts";
export const opportunityStages: Record<ClientOpportunityStage, string> = { new: "Nueva", qualified: "Cualificada", proposal: "Presupuesto", negotiation: "Negociación", won: "Ganada", lost: "Perdida" };
export const activityLabels: Record<string, string> = { note: "Nota", call: "Llamada", email: "Correo registrado", meeting: "Reunión", stage_change: "Cambio de fase" };
export function commercialDate(value: string | null | undefined): Date | null {
    if (!value)
        return null;
    const date = new Date(/Z$|[+-]\d{2}:\d{2}$/.test(value) ? value : value + "Z");
    return Number.isFinite(date.getTime()) ? date : null;
}
export function commercialLocalInput(value: string | null): string {
    const date = commercialDate(value);
    if (!date)
        return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function commercialFollowUpPending(stage: string, value: string | null, now = Date.now()): boolean {
    if (stage === "won" || stage === "lost")
        return false;
    const date = commercialDate(value);
    return !date || date.getTime() <= now;
}
