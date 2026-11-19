"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { CompanyCalendar } from "@/components/calendar/CompanyCalendar";
import { Button } from "@/components/ui/button";
import { LocationService, type Location } from "@/services/location.service";
import { TaskService, type TaskItem } from "@/services/task.service";
import { useUser } from "@/lib/user-context";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeEvents";
import { POLL_INTERVALS } from "@/lib/polling";
import { canViewCompanyCalendar } from "@/domain/access/roles";
import { taskWorkers } from "@/domain/tasks/operations-overview";

type CalendarData = { scope: string; tasks: TaskItem[]; locations: Location[] };
export default function CalendarPage() {
    const { user, loading } = useUser();
    const allowed = canViewCompanyCalendar(user);
    const scope = `${user?.id}:${user?.company_id}`;
    const currentScope = useRef(scope);
    useEffect(() => { currentScope.current = scope; return () => { currentScope.current = ""; }; }, [scope]);
    const request = useRef({version:0});
    const [data, setData] = useState<CalendarData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const loadData = useCallback(async () => {
        if (!allowed) return;
        const version = ++request.current.version;
        try {
            const [tasks, masterLocations] = await Promise.all([TaskService.getAllTaskItems(), LocationService.getAllLocations()]);
            const known = new Set(masterLocations.map(location => location.id));
            const missing = [...new Set(tasks.map(task => task.location_id))].filter(id => !known.has(id));
            const details = await Promise.allSettled(missing.map(id => LocationService.getLocation(id)));
            if (currentScope.current !== scope || version !== request.current.version) return;
            setData({ scope, tasks, locations: [...masterLocations, ...details.flatMap(result => result.status === "fulfilled" ? [result.value] : [])] });
            setError(details.some(result => result.status === "rejected") ? "Algunas ubicaciones no están disponibles. Los trabajos conservan su identificador." : null);
        } catch (cause) {
            if (currentScope.current === scope && version === request.current.version) setError(cause instanceof Error ? cause.message : "No se pudo cargar el calendario.");
        }
    }, [allowed, scope]);
    useEffect(() => { const pending=request.current; const timer = window.setTimeout(() => void loadData(), 0); return () => { window.clearTimeout(timer); pending.version++; }; }, [loadData]);
    useBackgroundPolling(loadData, POLL_INTERVALS.calendar, POLL_INTERVALS.realtimeSafety);
    useRealtimeInvalidation(["calendar", "locations", "reservations", "tasks"], () => { void loadData(); });
    const visible = data?.scope === scope ? data : null;
    if (loading) return <p role="status" className="p-6">Cargando acceso al calendario…</p>;
    if (!allowed) return <main className="dashboard-page-content p-8"><ShieldAlert aria-hidden="true" className="size-8 text-orange-600" /><h1 className="mt-3 text-xl font-semibold">Calendario restringido</h1><p>No tienes permiso para consultar el calendario de esta empresa.</p></main>;
    const people = new Map<number, { id: number; full_name: string; email: string }>();
    if (user) people.set(user.id, { id: user.id, full_name: user.full_name || user.email, email: user.email });
    for (const task of visible?.tasks ?? []) for (const person of taskWorkers(task)) if (!people.has(person.id)) people.set(person.id, { id: person.id, full_name: person.name || `Trabajador #${person.id}`, email: "" });
    return <main className="dashboard-page-content px-[3%] py-6 md:p-8">
        {error && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-orange-400/40 bg-orange-500/5 p-4 text-sm"><p className="flex-1">{error}{visible ? " Se mantiene la última información cargada." : ""}</p><Button variant="outline" onClick={() => void loadData()}>Reintentar</Button></div>}
        {visible ? <CompanyCalendar key={scope} tasks={visible.tasks} locations={visible.locations} users={[...people.values()]} currentUser={user} onTasksChanged={loadData} /> : !error && <div role="status" className="flex min-h-96 items-center justify-center gap-2"><Loader2 aria-hidden="true" className="size-5 animate-spin" />Cargando todos los trabajos…</div>}
    </main>;
}
