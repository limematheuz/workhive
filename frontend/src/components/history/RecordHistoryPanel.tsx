"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, History, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { readRecordHistory, type RecordEntity, type RecordHistoryPage } from "@/services/record-history.service";

const timestamp = new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
const actionLabels: Record<string, string> = {
    "workforce.scope_changed":"Reparto de trabajo modificado",
    "Ficha creada":"Ficha creada", "Datos modificados":"Datos modificados", "Ficha eliminada":"Ficha eliminada",
    "staff.saved":"Ficha laboral guardada", "work_order.created":"Programación creada", "work_order.updated":"Programación modificada",
    "work_order.task_generated":"Ejecución generada", "quote.created":"Presupuesto creado", "quote.updated":"Presupuesto modificado",
    "quote.accepted":"Presupuesto aceptado", "quote.sent":"Presupuesto enviado", "service_contract.updated":"Condiciones modificadas",
    "location.created":"Centro creado", "location.updated":"Centro modificado", "client.created":"Cliente creado", "client.updated":"Cliente modificado",
};
export function RecordHistoryPanel(props: { entityType: RecordEntity; entityId: number }) {
    return <HistorySession key={props.entityType + ":" + props.entityId} {...props} />;
}
function HistorySession({ entityType, entityId }: { entityType: RecordEntity; entityId: number }) {
    const [open, setOpen] = useState(false), [offset, setOffset] = useState(0);
    const [data, setData] = useState<RecordHistoryPage | null>(null), [error, setError] = useState("");
    const [pending, setPending] = useState<number | null>(null);
    const generation = useRef(0);
    useEffect(() => () => { generation.current += 1; }, []);
    async function load(next = 0) {
        const token = ++generation.current;
        setPending(token); setError("");
        try { const page = await readRecordHistory(entityType, entityId, next); if (token === generation.current) { setData(page); setOffset(next); } }
        catch (cause) { if (token === generation.current) setError(cause instanceof Error ? cause.message : "No se pudo cargar el historial."); }
        finally { if (token === generation.current) setPending(current => current === token ? null : current); }
    }
    return <Collapsible open={open} onOpenChange={next => { setOpen(next); if (next && !data && pending === null) void load(); }} className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)]">
        <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"><History aria-hidden="true" className="size-4 text-muted-foreground" /><span className="flex-1">Historial de cambios</span><ChevronDown aria-hidden="true" className={"size-4 transition-transform " + (open ? "rotate-180" : "")} /></CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 border-t p-3">
            <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">Actividad registrada · fechas UTC</p><Button type="button" size="sm" variant="ghost" disabled={pending !== null} aria-label="Actualizar historial" onClick={() => void load(offset)}><RefreshCw className="size-3.5" /></Button></div>
            {pending !== null && <p role="status" className="text-xs text-muted-foreground">Cargando historial…</p>}
            {error && <p role="alert" className="text-xs text-orange-700 dark:text-orange-300">{error}</p>}
            {data && !data.items.length && <p className="text-xs text-muted-foreground">Todavía no hay cambios registrados para esta ficha.</p>}
            {data?.items.map(item => <article key={item.id} className="space-y-2 rounded-lg border border-[var(--border-soft)] p-3"><div className="flex flex-wrap items-center justify-between gap-1"><strong className="text-xs">{actionLabels[item.action] ?? "Actividad registrada"}</strong><time className="text-[10px] text-muted-foreground" dateTime={item.occurred_at}>{timestamp.format(new Date(item.occurred_at))}</time></div><p className="text-xs text-muted-foreground">{item.actor_name}</p>{item.changes.map(change => <div key={change.field} className="grid gap-1 border-t pt-2 text-xs sm:grid-cols-[minmax(6rem,1fr)_2fr]"><span className="font-medium">{change.label}</span><span className="min-w-0 whitespace-pre-wrap break-words"><span className="text-muted-foreground">{change.before_known ? change.before ?? "Sin valor" : "Anterior no registrado"}</span><span aria-label="cambia a"> → </span>{change.after ?? "Sin valor"}</span></div>)}{item.fields.length > 0 && <p className="text-xs text-muted-foreground">Campos: {item.fields.join(", ")}</p>}</article>)}
            {data && <div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={pending !== null || offset === 0} onClick={() => void load(Math.max(0, offset - 50))}>Anterior</Button><Button type="button" size="sm" variant="outline" disabled={pending !== null || !data.has_more} onClick={() => void load(offset + 50)}>Siguientes 50</Button></div>}
        </CollapsibleContent>
    </Collapsible>;
}
