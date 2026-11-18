"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarClock, FileCheck2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {SearchableSelect} from "@/components/ui/searchable-select";
import {searchWorkLocations,type QuickLocation} from "@/services/quick-work.service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SpaceWorkforceEditor } from "./SpaceWorkforceEditor";
import { LocationWorkspaceService } from "@/services/location-workspace.service";
import { getErrorMessage } from "@/lib/errors";
import type { Location, LocationSpace } from "@/types/location";
import type { WorkOrder, WorkOrderContractCandidate } from "@/types/work-order";
import { createServicePlan, workforceChoices, contractSpaceScope, type PlannedService, type SpaceAllocation, type WorkforceChoices } from "@/services/service-planning.service";

const noChoices: WorkforceChoices = { people: [], crews: [] };

export function ServicePlanner({ locations, contracts = [], saved, initialLocationId, navigateOnCreate = true }: { locations: Location[]; contracts?: WorkOrderContractCandidate[]; saved?: (order: WorkOrder, result?: PlannedService) => void; initialLocationId?: number; navigateOnCreate?: boolean }) {
    const router = useRouter();
    const [siteQuery,setSiteQuery]=useState("");
    const [siteMatches,setSiteMatches]=useState<QuickLocation[]|null>(null);
    const [searchingSites,setSearchingSites]=useState(false);
    const [location, setLocation] = useState(initialLocationId ? String(initialLocationId) : "");
    const [title, setTitle] = useState("");
    const [start, setStart] = useState("");
    const [kind, setKind] = useState("one_off");
    const [frequency, setFrequency] = useState("weekly");
    const [recurrenceInterval, setRecurrenceInterval] = useState("1");
    const [contract, setContract] = useState("");
    const [count, setCount] = useState("");
    const [contractNote, setContractNote] = useState("");
    const [spaces, setSpaces] = useState<LocationSpace[]>([]);
    const [choices, setChoices] = useState(noChoices);
    const [selection, setSelection] = useState<SpaceAllocation[]>([]);
    const [busy, setBusy] = useState(false);
    const [loadingSpaces, setLoadingSpaces] = useState(Boolean(initialLocationId));
    const [pendingContractRequest, setPendingContractRequest] = useState<number | null>(null);
    const [error, setError] = useState("");
    const contractRequest = useRef(0);
    const loadingContract = pendingContractRequest !== null;
    const loading = loadingSpaces || loadingContract;
    const managedLocations = locations.filter(site => site.can_manage_tasks);
    const locationContracts = contracts.filter(item => item.location_id === Number(location));
    const exhaustedContract = contractNote.startsWith("Todas las visitas");

    useEffect(()=>{let active=true;const timer=window.setTimeout(()=>{setSearchingSites(true);searchWorkLocations(siteQuery).then(rows=>{if(active)setSiteMatches(rows);}).catch(()=>{}).finally(()=>{if(active)setSearchingSites(false);});},200);return()=>{active=false;window.clearTimeout(timer);};},[siteQuery]);

    useEffect(() => {
        let active = true;
        if (location) {
            void Promise.all([
                LocationWorkspaceService.getSpaces(Number(location)),
                workforceChoices(Number(location)),
            ]).then(([nextSpaces, nextChoices]) => {
                if (active) {
                    setSpaces(nextSpaces);
                    setChoices(nextChoices);
                    setLoadingSpaces(false);
                }
            }).catch(cause => {
                if (active) {
                    setError(getErrorMessage(cause, "No se pudieron cargar los espacios y la plantilla."));
                    setLoadingSpaces(false);
                }
            });
        }
        return () => { active = false; contractRequest.current += 1; };
    }, [location]);

    function changeLocation(next: string) {
        contractRequest.current += 1;
        setLocation(next); setContract(""); setSpaces([]); setChoices(noChoices);
        setSelection([]); setLoadingSpaces(Boolean(next)); setPendingContractRequest(null);
        setError(""); setCount(""); setContractNote("");
    }

    async function changeContract(next: string) {
        const request = ++contractRequest.current;
        const requestedLocation = Number(location);
        setContract(next); setContractNote(""); setError("");
        if (!next) { setPendingContractRequest(null); return; }
        setPendingContractRequest(request);
        try {
            const scope = await contractSpaceScope(Number(next), requestedLocation);
            if (request !== contractRequest.current) return;
            if (scope.spaces.length) {
                setSelection(scope.spaces);
                const remaining = scope.remaining_occurrences ?? 1;
                setCount(String(Math.max(1, remaining)));
                setKind(remaining > 1 ? "recurring" : "one_off");
                setContractNote(remaining > 0
                    ? "Alcance del presupuesto aceptado recuperado · " + remaining + " visitas pendientes. Si cambias espacios o tareas, revisa el importe del trabajo."
                    : "Todas las visitas presupuestadas ya están generadas. Amplía el acuerdo para crear más.");
            } else {
                setContractNote("Este contrato no tiene un reparto presupuestado compatible. Selecciona los espacios y revisa el precio de la ejecución.");
            }
        } catch (cause) {
            if (request === contractRequest.current) setError(getErrorMessage(cause, "No se pudo recuperar el alcance."));
        } finally {
            if (request === contractRequest.current) setPendingContractRequest(current => current === request ? null : current);
        }
    }

    async function create() {
        if (busy || loading || exhaustedContract) return;
        if (!selection.length) { setError("Selecciona al menos un espacio."); return; }
        setBusy(true); setError("");
        try {
            const result = await createServicePlan({
                title, location_id: Number(location), scheduled_start_at: new Date(start).toISOString(),
                status: "active", order_type: kind as "one_off" | "recurring",
                service_contract_id: contract ? Number(contract) : undefined,
                ...(kind === "recurring" ? { recurrence_unit: frequency as "weekly" | "monthly", recurrence_interval: Number(recurrenceInterval) } : {}),
            }, selection, true, kind === "recurring" && count ? Number(count) : undefined);
            saved?.(result.work_order, result);
            if (navigateOnCreate && result.task_id) router.push("/dashboard?taskId=" + result.task_id);
        } catch (cause) {
            setError(getErrorMessage(cause, "No se pudo planificar el trabajo."));
        } finally {
            setBusy(false);
        }
    }

    return <form className="space-y-4" onSubmit={event => { event.preventDefault(); void create(); }}>
        <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card)]">
            <div className="flex items-center gap-2.5 border-b border-[var(--border-soft)] px-4 py-3"><span aria-hidden="true" className="flex size-8 items-center justify-center rounded-md bg-[var(--brand-blue-soft)] text-accent"><CalendarClock className="size-4" /></span><div><h3 className="text-sm font-semibold">Datos del trabajo</h3><p className="text-xs text-muted-foreground">Elige dónde y cuándo se realiza el servicio.</p></div></div>
            <fieldset disabled={busy} className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-2"><Label htmlFor="service-planner-title">Nombre del trabajo</Label><Input id="service-planner-title" required maxLength={160} placeholder="Limpieza de la planta 2" value={title} onChange={event => setTitle(event.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="service-planner-location">Ubicación</Label><SearchableSelect required disabled={busy} id="service-planner-location" aria-label="Ubicación del trabajo" value={location} onValueChange={changeLocation} onSearchChange={setSiteQuery} loading={searchingSites} placeholder="Buscar centro por nombre o dirección…" options={(siteMatches??managedLocations).map(site=>({value:String(site.id),label:site.name,description:site.address+" · "+site.city}))}/></div>
                <div className="space-y-1.5"><Label htmlFor="service-planner-start">Inicio del trabajo</Label><DateTimePicker id="service-planner-start" aria-label="Inicio del trabajo por espacios" value={start || null} onValueChange={next => setStart(next ?? "")} /></div>
                <div className="space-y-1.5"><Label htmlFor="service-planner-kind">Frecuencia</Label><Select disabled={busy || loadingContract} value={kind} onValueChange={setKind}><SelectTrigger id="service-planner-kind"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="one_off">Una sola vez</SelectItem><SelectItem value="recurring">Servicio recurrente</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label htmlFor="service-planner-contract">Contrato de servicio</Label><SearchableSelect disabled={busy || loadingSpaces || !location} id="service-planner-contract" aria-label="Contrato de servicio" value={contract} onValueChange={next=>void changeContract(next)} options={[{value:"",label:"Sin contrato vinculado"},...locationContracts.map(item=>({value:String(item.contract_id),label:item.contract_title}))]}/></div>
                {kind === "recurring" && <>
                    <div className="space-y-1.5"><Label htmlFor="service-planner-interval">Repetir cada</Label><Input id="service-planner-interval" required type="number" min="1" max="52" value={recurrenceInterval} onChange={event => setRecurrenceInterval(event.target.value)} /></div>
                    <div className="space-y-1.5"><Label htmlFor="service-planner-unit">Unidad</Label><Select disabled={busy} value={frequency} onValueChange={setFrequency}><SelectTrigger id="service-planner-unit"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="weekly">Semanas</SelectItem><SelectItem value="monthly">Meses</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1.5"><Label htmlFor="service-planner-count">Número de visitas</Label><Input id="service-planner-count" disabled={loadingContract} type="number" min="1" max="1000" value={count} onChange={event => setCount(event.target.value)} placeholder="Sin límite de visitas" /><p className="text-xs text-muted-foreground">La programación finalizará tras esas visitas.</p></div>
                </>}
            </fieldset>
            {!managedLocations.length&&!siteMatches?.length && <p className="px-4 pb-4 text-xs text-orange-700 dark:text-orange-300">No hay ubicaciones disponibles para planificar. <Link className="underline" href="/dashboard/locations">Revisar ubicaciones</Link></p>}
        </section>
        {contractNote && <div role="status" className={"flex gap-2 rounded-xl border p-3 text-sm " + (contractNote.startsWith("Alcance del presupuesto") ? "border-[var(--brand-blue-border)] bg-[var(--brand-blue-soft)] text-[var(--text-main)]" : "border-orange-300/50 bg-orange-500/5 text-orange-700 dark:text-orange-300")}><FileCheck2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><p>{contractNote}</p></div>}
        {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="size-4 animate-spin" />{loadingContract ? "Recuperando espacios y visitas del contrato…" : "Cargando espacios, tareas y plantilla…"}</p>}
        {location && !loading && <SpaceWorkforceEditor spaces={spaces} choices={choices} value={selection} onChange={setSelection} disabled={busy} />}
        {error && <p role="alert" className="rounded-xl border border-orange-300/50 bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-3"><p className="max-w-xl text-xs text-muted-foreground">La selección queda guardada para esta ejecución y las siguientes del servicio recurrente.</p><Button disabled={busy || loading || !selection.length || !start || exhaustedContract}>{busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}{busy ? "Guardando…" : "Crear y abrir trabajo"}</Button></div>
    </form>;
}
