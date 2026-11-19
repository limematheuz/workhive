"use client";
import {FormSelect} from "@/components/ui/form-select";
import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { writeResourceLog, type Vehicle } from "@/services/resource-log.service";
import type { Employee } from "@/services/staff.service";
import type { Location } from "@/services/location.service";
export function JourneyForm({ vehicles, staff, sites, saved }: {
    vehicles: Vehicle[];
    staff: Pick<Employee, "id" | "name">[];
    sites: Location[];
    saved: () => void;
}) {
    const [draft, setDraft] = useState({ vehicle_id: "", employee_id: "", location_id: "", start: "", end: "", start_km: "", end_km: "", notes: "" });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setBusy(true);
        setError("");
        try {
            await writeResourceLog("journeys", { vehicle_id: Number(draft.vehicle_id), employee_id: Number(draft.employee_id), location_id: Number(draft.location_id),
                starts_at: new Date(draft.start).toISOString(), ends_at: new Date(draft.end).toISOString(), start_km: draft.start_km, end_km: draft.end_km, notes: draft.notes });
            setDraft(current => ({ ...current, start: "", end: "", notes: "" }));
            saved();
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "No se pudo registrar el trayecto.");
        } finally {
            setBusy(false);
        }
    }
    return <form className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3" onSubmit={event => void handleSubmit(event)}>
        <label>Vehículo<FormSelect aria-label={"Vehículo"} required  value={draft.vehicle_id} onValueChange={selectedOptionValue=>setDraft({ ...draft, vehicle_id: selectedOptionValue, start_km: vehicles.find(v => v.id === Number(selectedOptionValue))?.odometer ?? "" })}><option value="">Seleccionar</option>{vehicles.flatMap(v => v.status === "active" ? [<option key={v.id} value={v.id}>{v.name} · {v.registration}</option>] : [])}</FormSelect></label>
        <label>Trabajador<FormSelect aria-label={"Trabajador"} required  value={draft.employee_id} onValueChange={selectedOptionValue=>setDraft({ ...draft, employee_id: selectedOptionValue })}><option value="">Seleccionar</option>{staff.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</FormSelect></label>
        <label>Centro de destino<FormSelect aria-label={"Centro de destino"} required  value={draft.location_id} onValueChange={selectedOptionValue=>setDraft({ ...draft, location_id: selectedOptionValue })}><option value="">Seleccionar</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</FormSelect></label>
        <label>Salida<DateTimePicker aria-label="Salida del trayecto" id="journey-start" value={draft.start || null} onValueChange={v => setDraft({ ...draft, start: v ?? "" })}/></label>
        <label>Llegada<DateTimePicker aria-label="Llegada del trayecto" id="journey-end" min={draft.start || null} value={draft.end || null} onValueChange={v => setDraft({ ...draft, end: v ?? "" })}/></label>
        <label>Km iniciales<Input required type="number" min="0" step=".1" value={draft.start_km} onChange={e => setDraft({ ...draft, start_km: e.target.value })}/></label>
        <label>Km finales<Input required type="number" min={draft.start_km} step=".1" value={draft.end_km} onChange={e => setDraft({ ...draft, end_km: e.target.value })}/></label>
        <label>Notas<Input maxLength={2000} value={draft.notes} onChange={e => setDraft({ ...draft, notes: e.target.value })}/></label>
        <Button className="self-end" disabled={busy || !draft.start || !draft.end}>Registrar trayecto</Button>
        {error && <p role="alert" className="text-orange-700 sm:col-span-3">{error}</p>}
    </form>;
}
