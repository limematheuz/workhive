"use client";
import {FormSelect} from "@/components/ui/form-select";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import { useCallback, useState } from "react";
import { ClipboardPenLine } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TaskReportService, type TaskReport } from "@/services/task-report.service";
import {LocationService,type Location} from "@/services/location.service";
import { TaskService } from "@/services/task.service";
import type { TaskItem } from "@/types/user";
import { useUser } from "@/lib/user-context";
export default function HandoverPage() {
    const { user } = useUser();
    const [sites,setSites]=useState<Location[]>([]);
    const [tasks, setTasks] = useState<TaskItem[]>([]), [notes, setNotes] = useState<TaskReport[]>([]), [selected, setSelected] = useState(""), [text, setText] = useState(""), [site, setSite] = useState("");
    const [error, setError] = useState(""), [busy, setBusy] = useState(false);
    const request = useCallback(() => Promise.all([TaskService.getAllTaskItems(), TaskReportService.list(),LocationService.getLocations()]), []);
    const receive = useCallback(([work, reports,centres]: Awaited<ReturnType<typeof request>>) => { setTasks(work);setSites(centres); setNotes(reports.filter(r => r.report_type === "note" && r.title === "Traspaso de turno")); setError(""); }, []);
    const failed = useCallback((error: unknown) => setError(error instanceof Error ? error.message : "No se pudo cargar el relevo."), []);
    async function load() { try {
        receive(await request());
    }
    catch (error) {
        failed(error);
    } }
    useResourceEffect(Boolean(user), `${user?.company_id}:${user?.id}`, request, receive, failed);
    const locations = Array.from(new Set(notes.map(n => n.location_name))).sort();
    return <div className="dashboard-page-content space-y-4"><PageHeader icon={ClipboardPenLine} title="Traspaso entre turnos" subtitle="Pendientes e instrucciones para el siguiente equipo, vinculados al trabajo y al centro."/>
 {error && <p role="alert" className="text-orange-700">{error}</p>}
 <form className="rounded-xl border p-4" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(""); try {
        await TaskReportService.create({ task_item_id: Number(selected), report_type: "note", title: "Traspaso de turno", description: text });
        setText("");
        await load();
    }
    catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar el relevo.");
    }
    finally {
        setBusy(false);
    } }}><fieldset disabled={busy} className="space-y-3"><label className="block text-sm">Trabajo y ubicación<FormSelect aria-label={"Trabajo y ubicación"} required  value={selected} onValueChange={selectedOptionValue=>setSelected(selectedOptionValue)}><option value="">Seleccionar trabajo autorizado</option>{tasks.filter(t => t.status !== "cancelled").map(t => <option key={t.id} value={t.id}>{t.title} · {sites.find(s=>s.id===t.location_id)?.name ?? "Centro #" + t.location_id}</option>)}</FormSelect></label><label className="block text-sm">Avisos y pendientes<Textarea required maxLength={4000} value={text} onChange={e => setText(e.target.value)} placeholder="Qué debe conocer el próximo equipo"/></label><Button>Guardar aviso de relevo</Button></fieldset></form>
 <label className="block text-sm">Filtrar centro<FormSelect aria-label={"Filtrar centro"}  value={site} onValueChange={selectedOptionValue=>setSite(selectedOptionValue)}><option value="">Todos los autorizados</option>{locations.map(name => <option key={name}>{name}</option>)}</FormSelect></label>
 <section className="divide-y rounded-xl border">{notes.filter(n => !site || n.location_name === site).map(n => <article key={n.id} className="space-y-1 p-4"><p className="font-semibold">{n.location_name} · {n.task_title}</p><p className="whitespace-pre-wrap text-sm">{n.description}</p><p className="text-xs text-muted-foreground">{n.reporter_name} · {new Date(n.created_at).toLocaleString("es-ES")}</p></article>)}{!notes.length && <p className="p-4 text-muted-foreground">Sin avisos de relevo registrados.</p>}</section></div>;
}
