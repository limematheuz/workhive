"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClientId } from "@/lib/editable-line-key";
import { previewDataImport, executeDataImport } from "@/services/data-import.service";
import { importPreviewColumns, importPreviewValue } from "@/lib/import-preview";

type ImportKind = "staff" | "clients" | "locations" | "work";
const importLabels:Record<ImportKind,string>={staff:"trabajadores",clients:"clientes",locations:"centros",work:"primeros trabajos"};
const importColumns:Record<ImportKind,string>={staff:"nombre, cargo, equipo, horas_mes, coste_hora.",clients:"nombre, dirección, ciudad, codigo_postal, país; opcionales: correo, telefono, nif.",locations:"nombre, dirección, ciudad; cliente opcional por nombre o client_id. Los espacios pueden añadirse después.",work:"titulo, inicio (2026-12-01 09:00), duracion_minutos, ubicación o dirección y ciudad. Opcionales: cliente, servicio, trabajadores y tareas; separa varios trabajadores o tareas con |. La hora sin desfase utiliza la zona de la empresa."};
type ImportRow = { key: string; record: Record<string, unknown> };
export function DataImportWorkspace({ fixedKind, onImported, showLinks = true }: { fixedKind?: ImportKind; onImported?: () => void; showLinks?: boolean }) {
    const [kind, setKind] = useState<ImportKind>(fixedKind ?? "staff");
    const [file, setFile] = useState<File | null>(null);
    const [rows, setRows] = useState<ImportRow[]>([]);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    async function preview() {
        if (!file) return;
        setBusy(true); setRows([]); setMessage("");
        try { setRows((await previewDataImport(kind, file)).map(record => ({ key: createClientId(), record }))); }
        catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se pudo preparar el archivo."); }
        finally { setBusy(false); }
    }
    async function execute() {
        setBusy(true); setMessage("");
        try {
            const result = await executeDataImport(kind, rows.map(row => row.record));
            setMessage(result.already_imported ? "Este archivo ya se había importado. Sus registros están disponibles." : result.ids.length + " registros importados.");
            setRows([]); onImported?.();
        } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se pudo importar."); }
        finally { setBusy(false); }
    }
    const columns = importPreviewColumns(kind, rows.map(row => row.record));
    return <section className="space-y-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4">
        <h3 className="text-sm font-semibold">Importar {importLabels[kind]}</h3>
        <form className="flex flex-wrap items-end gap-3" action={preview}>
            {!fixedKind && <label className="space-y-1 text-sm">Registros<Select disabled={busy} value={kind} onValueChange={value => { setKind(value as ImportKind); setRows([]); setMessage(""); }}><SelectTrigger aria-label="Tipo de importación"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="staff">Trabajadores</SelectItem><SelectItem value="clients">Clientes</SelectItem><SelectItem value="locations">Centros</SelectItem><SelectItem value="work">Primeros trabajos</SelectItem></SelectContent></Select></label>}
            <label className="min-w-0 flex-1 space-y-1 text-sm">Archivo XLSX o CSV<Input disabled={busy} required type="file" accept=".xlsx,.csv" onChange={event => { setFile(event.target.files?.[0] ?? null); setRows([]); setMessage(""); }} /></label>
            <Button disabled={busy || !file}>{busy ? "Procesando…" : "Revisar archivo"}</Button>
        </form>
        <p className="text-xs text-muted-foreground">Hasta 500 registros y 2 MB. La primera fila contiene las cabeceras; en XLSX se lee la primera hoja y los datos deben estar guardados como valores.</p>
        <p className="rounded-lg bg-muted/40 p-3 text-xs">{"Columnas: "+importColumns[kind]}</p>
        {message && <p role="status" className="text-sm text-orange-700 dark:text-orange-300">{message}</p>}
        {rows.length > 0 && <div className="space-y-3"><p className="text-sm">{rows.length} registros preparados para crear. Revisa los datos antes de confirmar.</p><div className="max-h-72 overflow-auto rounded-lg border"><table aria-label="Vista previa de importación" className="w-full text-left text-xs"><thead className="sticky top-0 bg-[var(--bg-card)]"><tr><th scope="col" className="p-2">Fila</th>{columns.map(column => <th scope="col" className="p-2" key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row,index) => <tr key={row.key} className="border-t"><th scope="row" className="p-2">{index+2}</th>{columns.map(column => <td key={column.key} className="max-w-72 p-2 [overflow-wrap:anywhere]">{importPreviewValue(row.record[column.key])}</td>)}</tr>)}</tbody></table></div><Button type="button" disabled={busy} onClick={() => void execute()}>Importar {rows.length} registros</Button></div>}
        {showLinks && <div className="flex flex-wrap gap-3 text-sm"><Link className="underline" href="/dashboard/plantilla/trabajadores">Ver trabajadores</Link><Link className="underline" href="/dashboard/clients">Ver clientes</Link><Link className="underline" href="/dashboard/locations">Ver centros</Link><Link className="underline" href="/dashboard/tasks">Ver trabajos</Link></div>}
    </section>;
}
