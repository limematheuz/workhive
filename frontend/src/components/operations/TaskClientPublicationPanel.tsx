"use client";
import { useCallback, useMemo, useState } from "react";
import { RefreshCw, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { PrivatePartPhoto } from "@/components/client-portal/PrivatePartPhoto";
import { TaskClientPublicationService, type PartCandidate } from "@/services/task-client-publication.service";
import { TaskPublishedPartPreview } from "./TaskPublishedPartPreview";

function toggleSelectedId(values: number[], id: number, checked: boolean) {
    return checked ? [...values, id] : values.filter(value => value !== id);
}

function PublicationEditor({ data, taskId, saved }: { data: PartCandidate; taskId: number; saved: (value: PartCandidate) => void }) {
    const [summary, setSummary] = useState("");
    const [checks, setChecks] = useState<number[]>([]);
    const [reports, setReports] = useState<number[]>([]);
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [preview, setPreview] = useState<number | null>(null);
    const [withdraw, setWithdraw] = useState(false);
    const dates = useMemo(() => new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short", timeZone: data.task.timezone }), [data.task.timezone]);
    const selectedChecks = useMemo(() => new Set(checks), [checks]);
    const selectedReports = useMemo(() => new Set(reports), [reports]);
    async function publish() {
        if (busy || !summary.trim() || !confirmed) return;
        setBusy(true); setError("");
        try {
            saved(await TaskClientPublicationService.publish(taskId, { public_summary: summary, checklist_item_ids: checks, report_ids: reports, expected_revision: data.latest_revision, expected_source_hash: data.source_hash, confirmed_publication: true }));
            toast.success("Parte publicado exclusivamente para el cliente de esta ubicación.");
        } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo publicar el parte."); } finally { setBusy(false); }
    }
    return <div className="space-y-4">
        <div className="rounded-xl border bg-muted/30 p-3 text-sm"><p><strong>Destinatario:</strong> {data.task.client_name || <span className="text-orange-700">Cliente pendiente</span>}</p><p className="mt-1 text-xs text-muted-foreground">{data.task.location_name} · {data.task.completed_at ? "Cierre: " + dates.format(new Date(data.task.completed_at)) : "Fecha de cierre pendiente"}</p><p className="mt-2 font-medium">{data.is_public ? `Publicado · revisión ${data.latest_revision}` : "Privado · sin parte visible al cliente"}</p>{data.latest?.acceptance && <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">Validado por {data.latest.acceptance.signer_name} el {dates.format(new Date(data.latest.acceptance.accepted_at))}</p>}</div>
        {data.latest && <TaskPublishedPartPreview key={data.latest.id} taskId={taskId} part={data.latest} />}
        {data.blocked_reason && <p className="rounded-xl bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-950 dark:text-orange-200">{data.blocked_reason}</p>}
        {data.can_publish && <fieldset disabled={busy} className="space-y-4"><label className="block text-sm font-medium">Resumen que verá el cliente<Textarea value={summary} onChange={event => setSummary(event.target.value)} maxLength={4000} placeholder="Describe el servicio realizado y las observaciones que quieres compartir." className="mt-2" /></label>
            <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Tareas que se mostrarán en el parte</legend>{data.checklist_items.length ? data.checklist_items.map(item => <label key={item.id} className="flex items-start gap-2 text-sm"><Checkbox checked={selectedChecks.has(item.id)} onCheckedChange={value => setChecks(rows => toggleSelectedId(rows, item.id, value === true))} /><span>{item.space_name ? item.space_name + " · " : ""}{item.text}<span className="ml-2 text-xs text-muted-foreground">{item.completed ? "Completada" : "Pendiente"}</span></span></label>) : <p className="text-xs text-muted-foreground">No hay tareas de checklist registradas para seleccionar.</p>}</fieldset>
            <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Reportes y fotos que se compartirán</legend>{data.reports.length ? data.reports.map(report => <div key={report.id} className="rounded-xl border p-3"><label className="flex items-start gap-2 text-sm"><Checkbox checked={selectedReports.has(report.id)} onCheckedChange={value => setReports(rows => toggleSelectedId(rows, report.id, value === true))} /><span className="min-w-0 flex-1"><strong className="block">{report.has_photo ? "Fotografía" : report.kind === "issue" ? "Incidencia" : "Nota"}{report.title ? " · " + report.title : ""}</strong>{report.text && <span className="mt-1 block whitespace-pre-wrap text-xs text-muted-foreground">{report.text}</span>}</span></label>{report.has_photo && <Button type="button" size="sm" variant="ghost" onClick={() => setPreview(value => value === report.id ? null : report.id)}>Revisar fotografía</Button>}{preview === report.id && <PrivatePartPhoto key={report.id} reportId={report.id} alt="Fotografía interna pendiente de selección explícita para el cliente" />}</div>) : <p className="text-xs text-muted-foreground">No hay reportes de esta empresa en el trabajo.</p>}{data.reports_has_more && <p className="text-xs text-orange-700">Se muestran los 200 reportes más recientes de esta ejecución.</p>}</fieldset>
            <label className="flex items-start gap-3 rounded-xl border p-3 text-sm leading-6"><Checkbox checked={confirmed} onCheckedChange={value => setConfirmed(value === true)} /><span>Confirmo la publicación del resumen y los registros seleccionados para este cliente. El resto de notas y fotos seguirá siendo privado.</span></label><Button type="button" disabled={!summary.trim() || !confirmed || busy} onClick={() => void publish()}><Send className="size-4" />{busy ? "Publicando…" : data.latest_revision ? "Publicar nueva revisión" : "Publicar parte al cliente"}</Button>
        </fieldset>}
        {data.is_public && <div className="space-y-2 border-t pt-3"><label className="flex items-center gap-2 text-xs"><Checkbox checked={withdraw} disabled={busy} onCheckedChange={value => setWithdraw(value === true)} />Retirar este parte y sus fotografías del portal</label><Button type="button" size="sm" variant="outline" disabled={!withdraw || busy} onClick={async () => { setBusy(true); setError(""); try { saved(await TaskClientPublicationService.revoke(taskId, data.latest_revision)); toast.success("Parte retirado del portal."); } catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo retirar el parte."); } finally { setBusy(false); } }}>Confirmar retirada</Button></div>}
        {error && <p role="alert" className="text-sm text-orange-700 dark:text-orange-300">{error}</p>}
    </div>;
}

export function TaskClientPublicationPanel({ taskId, updated }: { taskId: number; updated?: () => void }) {
    const [data, setData] = useState<PartCandidate | null>(null);
    const [error, setError] = useState("");
    const [revision, setRevision] = useState(0);
    const request = useCallback(() => TaskClientPublicationService.candidate(taskId), [taskId]);
    const received = useCallback((value: PartCandidate) => { setData(value); setError(""); }, []);
    const failed = useCallback((reason: unknown) => setError(reason instanceof Error ? reason.message : "No se pudo consultar la publicación."), []);
    useResourceEffect(true, `${taskId}:${revision}`, request, received, failed);
    const current = data?.task.id === taskId ? data : null;
    return <section className="space-y-4 rounded-2xl border bg-card p-4"><div className="flex items-start justify-between gap-2"><div><h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-4 text-accent" />Parte y validación del cliente</h3><p className="mt-1 text-xs text-muted-foreground">El trabajo y sus reportes son privados hasta que un responsable publique una selección.</p></div><Button type="button" size="sm" variant="outline" aria-label="Actualizar publicación del cliente" onClick={() => setRevision(value => value + 1)}><RefreshCw className="size-4" /></Button></div>{error && <p role="alert" className="text-sm text-orange-700 dark:text-orange-300">{error}</p>}{!current && !error && <p role="status" className="text-sm text-muted-foreground">Cargando estado del parte…</p>}{current && <PublicationEditor key={`${taskId}:${current.latest_revision}:${current.is_public}:${current.source_hash}`} data={current} taskId={taskId} saved={value => { setData(value); updated?.(); }} />}</section>;
}
