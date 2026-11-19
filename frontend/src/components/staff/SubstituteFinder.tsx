"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QUALIFICATIONS, type QualificationCode } from "@/domain/staff/staff-availability";
import { LocationService, type Location } from "@/services/location.service";
import { searchSubstitutes, assignSubstitute, type SubstituteResults, type SubstituteSearch } from "@/services/staff-substitution.service";
import type { Absence } from "@/services/staff-absence.service";

export function SubstituteFinder({ absence, close, saved }: { absence: Absence; close: () => void; saved: () => void }) {
    const [locations, setLocations] = useState<Location[]>([]);
    const [city, setCity] = useState("all"), [location, setLocation] = useState("");
    const [start, setStart] = useState<string | null>(null), [end, setEnd] = useState<string | null>(null);
    const [required, setRequired] = useState<QualificationCode[]>([]);
    const [data, setData] = useState<SubstituteResults | null>(null), [searched, setSearched] = useState<SubstituteSearch | null>(null);
    const [error, setError] = useState("");
    const [pendingRequest, setPendingRequest] = useState<number | null>(null);
    const busy = pendingRequest !== null;
    const request = useRef(0);
    useEffect(() => { let active = true; void LocationService.getLocations().then(rows => { if (active) setLocations(rows.filter(site => site.can_manage_tasks)); }).catch(() => { if (active) setError("No se pudieron cargar los centros."); }); return () => { active = false; request.current += 1; }; }, []);
    const reset = () => { setData(null); setSearched(null); setError(""); };
    const cities = useMemo(() => [...new Set(locations.flatMap(site => site.city ? [site.city] : []))], [locations]);
    const matchingLocations = useMemo(() => locations.filter(site => city === "all" || site.city === city), [locations, city]);
    const requiredCodes = new Set(required);
    async function search(offset = 0) {
        if (!location || !start || !end) return;
        const token = ++request.current;
        const payload: SubstituteSearch = { absence_id: absence.id, location_id: Number(location), starts_at: new Date(start).toISOString(), ends_at: new Date(end).toISOString(), required_training_codes: required, offset };
        setPendingRequest(token); setError(""); setData(null);
        try { const rows = await searchSubstitutes(payload); if (token === request.current) { setData(rows); setSearched(payload); } }
        catch (cause) { if (token === request.current) setError(cause instanceof Error ? cause.message : "No se pudo buscar."); }
        finally { if (token === request.current) setPendingRequest(current => current === token ? null : current); }
    }
    async function assign(employee: number) {
        if (!searched) return;
        const token = ++request.current;
        setPendingRequest(token); setError("");
        try { await assignSubstitute({ ...searched, employee_id: employee }); saved(); close(); }
        catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo asignar."); }
        finally { if (token === request.current) setPendingRequest(current => current === token ? null : current); }
    }
    return <Dialog open onOpenChange={open => { if (!open && !busy) close(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Bolsa de sustituciones</DialogTitle><DialogDescription>Ausencia del {absence.starts_on} al {absence.ends_on}. La asignación cubre toda la ausencia y vuelve a comprobar todos sus turnos antes de guardarse.</DialogDescription></DialogHeader>
        <form className="space-y-3" action={() => search()}><fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm">Zona / ciudad<Select disabled={busy} value={city} onValueChange={value => { setCity(value); setLocation(""); reset(); }}><SelectTrigger aria-label="Zona de la sustitución"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas las zonas</SelectItem>{cities.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select></label>
            <label className="space-y-1 text-sm">Centro<Select disabled={busy} value={location} onValueChange={value => { setLocation(value); reset(); }}><SelectTrigger aria-label="Centro a cubrir"><SelectValue placeholder="Seleccionar centro" /></SelectTrigger><SelectContent>{matchingLocations.map(site => <SelectItem key={site.id} value={String(site.id)}>{site.name} · {site.city}</SelectItem>)}</SelectContent></Select></label>
            <label className="space-y-1 text-sm">Inicio de cobertura<DateTimePicker id="substitution-start" value={start} min={absence.starts_on + "T00:00"} max={absence.ends_on + "T23:59"} onValueChange={value => { setStart(value); reset(); }} /></label>
            <label className="space-y-1 text-sm">Fin de cobertura<DateTimePicker id="substitution-end" value={end} min={start} max={absence.ends_on + "T23:59"} onValueChange={value => { setEnd(value); reset(); }} /></label>
            <fieldset className="grid gap-2 rounded-lg border p-3 sm:col-span-2 sm:grid-cols-2"><legend className="px-1 text-sm font-medium">Formación necesaria</legend>{Object.entries(QUALIFICATIONS).map(([code, label]) => <label key={code} className="flex items-center gap-2 text-xs"><Checkbox disabled={busy} checked={requiredCodes.has(code as QualificationCode)} onCheckedChange={checked => { setRequired(current => checked === true ? [...current, code as QualificationCode] : current.filter(item => item !== code)); reset(); }} />{label}</label>)}</fieldset>
        </fieldset><Button disabled={busy || !location || !start || !end}><Search className="size-4" />{busy ? "Comprobando…" : "Buscar candidatos"}</Button></form>
        {error && <p role="alert" className="rounded-lg bg-orange-500/5 p-3 text-sm text-orange-700 dark:text-orange-300">{error}</p>}
        {data && <section className="space-y-2"><p className="text-xs text-muted-foreground">Disponibilidad evaluada en {data.timezone}. Las personas sin datos verificables o con restricciones se muestran con el motivo y no pueden asignarse.</p>{!data.items.length && <p className="text-sm text-orange-700">No hay trabajadores registrados en esta página.</p>}{data.items.map(person => <article key={person.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><strong className="text-sm">{person.name}</strong><p className="text-xs text-muted-foreground">{person.position} · {person.state}</p>{person.reasons.map(reason => <p key={reason} className="text-xs text-orange-700 dark:text-orange-300">{reason}</p>)}</div><Button type="button" size="sm" variant="outline" disabled={busy || !person.eligible} onClick={() => void assign(person.id)}>Asignar a toda la ausencia</Button></article>)}<div className="flex gap-2"><Button type="button" variant="outline" disabled={busy || !searched?.offset} onClick={() => void search(Math.max(0, (searched?.offset ?? 0) - 100))}>Anterior</Button><Button type="button" variant="outline" disabled={busy || !data.has_more} onClick={() => void search((searched?.offset ?? 0) + 100)}>Siguientes 100</Button></div></section>}
    </DialogContent></Dialog>;
}
