import type { DocumentOwnerType, RegisteredDocument } from "../services/document-register.service.ts";

export const documentOwnerLabels: Record<DocumentOwnerType, string> = { client: "Cliente", location: "Centro", staff: "Trabajador" };
export const documentTypeLabels: Record<string, string> = { other: "Otro", contract: "Contrato", payroll: "Nómina", training: "Formación", epi: "Entrega de EPI", insurance: "Seguro", protocol: "Protocolo" };
const timestamps = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" });
export function documentTimestamp(value: string | null | undefined) {
    if (!value) return "—";
    const date = new Date(/[zZ]$|[+-]\d\d:\d\d$/.test(value) ? value : value + "Z");
    return Number.isNaN(date.getTime()) ? "—" : timestamps.format(date);
}
export function documentCalendarDate(value: string | null | undefined) { return value ? value.split("-").reverse().join("/") : "Sin caducidad"; }
export function documentBytes(bytes: number) { return bytes < 1048576 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`; }
export function documentKey(row: RegisteredDocument) { return row.id === null ? `${row.source_type}:${row.source_id}` : `registered:${row.id}`; }
