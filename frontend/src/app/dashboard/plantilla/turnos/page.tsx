"use client";
import {FormSelect} from "@/components/ui/form-select";
import { useResourceEffect } from "@/hooks/useResourceEffect";
import Link from "next/link";
import { useCallback, useState } from "react";
import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useUser } from "@/lib/user-context";
import { canViewLaborCosts, canManageLaborCosts } from "@/domain/access/roles";
import { StaffService, type Employee } from "@/services/staff.service";
import { LocationService, type Location } from "@/services/location.service";
import { TaskService } from "@/services/task.service";
import type { TaskItem } from "@/types/user";
import { readStaffShifts, saveStaffShift, type StaffShift } from "@/services/staff-shift.service";
const empty = { employee_id: "", location_id: "", task_id: "", start: "", end: "" };
function localDateTime(value: string) {
    const date = new Date(value);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}
export default function StaffShiftsPage() {
    const { user, loading } = useUser();
    const [rows, setRows] = useState<StaffShift[]>([]);
    const [people, setPeople] = useState<Employee[]>([]);
    const [sites, setSites] = useState<Location[]>([]);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [draft, setDraft] = useState(empty);
    const [editing, setEditing] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const allowed = canViewLaborCosts(user);
    const request = useCallback(() => Promise.all([readStaffShifts(), StaffService.list(), LocationService.getLocations(), TaskService.getAllTaskItems()]), []);
    const receive = useCallback(([shifts, staff, locations, work]: Awaited<ReturnType<typeof request>>) => { setRows(shifts); setPeople(staff); setSites(locations); setTasks(work); setError(""); }, []);
    const failed = useCallback((error: unknown) => setError(error instanceof Error ? error.message : "No se pudieron cargar los datos."), []);
    async function reload() { try {
        receive(await request());
    }
    catch (error) {
        failed(error);
    } }
    useResourceEffect(allowed, `${user?.company_id}:${user?.id}`, request, receive, failed);
    async function save() {
        setBusy(true);
        setError("");
        try {
            await saveStaffShift(editing, { employee_id: Number(draft.employee_id), location_id: Number(draft.location_id),
                task_id: Number(draft.task_id) || null, starts_at: new Date(draft.start).toISOString(), ends_at: new Date(draft.end).toISOString() });
            setDraft(empty);
            setEditing(null);
            await reload();
        }
        catch (e) {
            setError(e instanceof Error ? e.message : "No se pudo guardar.");
        }
        finally {
            setBusy(false);
        }
    }
    if (loading)
        return <p>Cargando…</p>;
    if (!allowed)
        return <p>Acceso restringido.</p>;
    const name = (id: number | null) => people.find(p => p.id === id)?.name ?? "Pendiente de cubrir";
    return <div className="dashboard-page-content space-y-3">
        <PageHeader icon={CalendarClock} title="Turnos y cobertura" subtitle="Horarios de la plantilla, sustituciones y trabajos vinculados." actions={<Button variant="outline" onClick={() => void reload()}>Actualizar</Button>}/>
        {canManageLaborCosts(user) && <form className="grid gap-3 rounded-xl border p-4 sm:grid-cols-2 xl:grid-cols-3" onSubmit={e => { e.preventDefault(); void save(); }}>
            <label>Trabajador<FormSelect searchable required aria-label="Trabajador del turno" value={draft.employee_id} onValueChange={value=>setDraft({...draft,employee_id:value})}><option value="">Seleccionar trabajador</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</FormSelect></label>
            <label>Ubicación<FormSelect searchable required aria-label="Ubicación del turno" value={draft.location_id} onValueChange={value=>setDraft({...draft,location_id:value,task_id:""})}><option value="">Seleccionar ubicación</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</FormSelect></label>
            <label>Trabajo<FormSelect searchable aria-label="Trabajo del turno" value={draft.task_id} onValueChange={value=>setDraft({...draft,task_id:value})}><option value="">Sin vincular</option>{tasks.filter(t => t.location_id === Number(draft.location_id)).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</FormSelect></label>
            <label>Inicio<DateTimePicker aria-label="Inicio del turno" id="shift-start" value={draft.start || null} onValueChange={v => setDraft({ ...draft, start: v ?? "" })}/></label>
            <label>Fin<DateTimePicker aria-label="Fin del turno" id="shift-end" min={draft.start || null} value={draft.end || null} onValueChange={v => setDraft({ ...draft, end: v ?? "" })}/></label>
            <div className="flex items-end gap-2"><Button disabled={busy || !draft.start || !draft.end}>{editing ? "Guardar turno" : "Programar turno"}</Button>{editing && <Button type="button" variant="outline" onClick={() => { setEditing(null); setDraft(empty); }}>Cancelar</Button>}</div>
        </form>}
        {error && <p role="alert" className="text-orange-700">{error}</p>}
        <Link className="inline-block text-sm underline" href="/dashboard/plantilla/ausencias">Gestionar ausencias y sustitutos</Link>
        {!rows.length && !error && <p>Sin turnos programados.</p>}
        {rows.map(row => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
            <div><strong>{name(row.effective_employee_id)}</strong><p className="text-sm">{sites.find(s => s.id === row.location_id)?.name} · {new Date(row.starts_at).toLocaleString()} — {new Date(row.ends_at).toLocaleTimeString()}</p>
                {row.coverage === "Sustitución" && <p className="text-sm">Sustituye a {name(row.employee_id)}</p>}
                {row.task_id && <Link className="text-sm underline" href={"/dashboard?taskId=" + row.task_id}>Abrir trabajo</Link>}</div>
            <span className={row.effective_employee_id === null ? "text-orange-700" : ""}>{row.coverage}</span>
            {canManageLaborCosts(user) && <Button variant="outline" onClick={() => { setEditing(row.id); setDraft({ employee_id: String(row.employee_id), location_id: String(row.location_id), task_id: String(row.task_id ?? ""), start: localDateTime(row.starts_at), end: localDateTime(row.ends_at) }); }}>Editar turno</Button>}
        </article>)}
    </div>;
}
