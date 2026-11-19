type Column = { key: string; label: string };
const fields: Record<string, Column[]> = {
    staff: [{key:"name",label:"Trabajador"},{key:"position",label:"Cargo"},{key:"team",label:"Equipo"},{key:"monthly_hours",label:"Horas/mes"},{key:"hourly_cost",label:"Coste/hora"}],
    clients: [{key:"name",label:"Cliente"},{key:"email",label:"Correo"},{key:"address",label:"Dirección"},{key:"city",label:"Ciudad"},{key:"tax_id",label:"NIF"}],
    locations: [{key:"name",label:"Centro"},{key:"client_id",label:"Cliente · ID"},{key:"address",label:"Dirección"},{key:"city",label:"Ciudad"}],
    work: [{key:"title",label:"Trabajo"},{key:"location_id",label:"Centro · ID"},{key:"address",label:"Dirección puntual"},{key:"scheduled_start_at",label:"Inicio"},{key:"duration_minutes",label:"Minutos"},{key:"employee_ids",label:"Trabajadores · ID"},{key:"tasks",label:"Tareas"}],
};
export function importPreviewColumns(kind: string, records: Record<string,unknown>[]): Column[] {
    return (fields[kind] ?? []).filter(column => records.some(row => row[column.key] != null && row[column.key] !== ""));
}
export function importPreviewValue(value: unknown): string {
    if (value == null || value === "") return "—";
    if (Array.isArray(value)) return value.map(importPreviewValue).join(" · ");
    if (typeof value === "boolean") return value ? "Sí" : "No";
    if (typeof value === "object") return "Datos adicionales";
    return String(value);
}
