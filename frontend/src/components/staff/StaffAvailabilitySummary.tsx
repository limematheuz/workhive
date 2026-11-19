"use client";
import { useEffect, useMemo, useState } from "react";
import { WEEKDAYS } from "@/domain/staff/staff-availability";
import { LocationService, type Location } from "@/services/location.service";
import type { Employee } from "@/services/staff.service";

export function StaffAvailabilitySummary({ worker }: { worker: Employee }) {
    const [locations, setLocations] = useState<Location[]>([]);
    const [error, setError] = useState("");
    useEffect(() => {
        let active = true;
        void LocationService.getLocations().then(rows => { if (active) setLocations(rows); }).catch(() => { if (active) setError("No se pueden consultar los nombres de los centros con este acceso."); });
        return () => { active = false; };
    }, []);
    const names = useMemo(() => new Map(locations.map(site => [site.id, site.name])), [locations]);
    const slots = worker.profile.weekly_availability;
    const centers = worker.profile.compatible_location_ids;
    return <div className="space-y-3 text-sm">
        <section><h3 className="font-semibold">Horario semanal</h3><p className="text-xs text-muted-foreground">Zona horaria de la empresa</p>
            {slots == null ? <p className="mt-1 text-orange-700 dark:text-orange-300">Pendiente de configurar para la bolsa.</p> : slots.length === 0 ? <p className="mt-1 text-orange-700 dark:text-orange-300">Sin franjas disponibles.</p> : <ul className="mt-2 space-y-1">{slots.map(slot => <li key={slot.weekday + ":" + slot.starts_at + ":" + slot.ends_at} className="flex justify-between gap-2"><span>{WEEKDAYS[slot.weekday]}</span><strong>{slot.starts_at}–{slot.ends_at}</strong></li>)}</ul>}
        </section>
        <section><h3 className="font-semibold">Centros compatibles</h3>{centers == null ? <p className="mt-1 text-orange-700 dark:text-orange-300">Pendiente de configurar para la bolsa.</p> : centers.length === 0 ? <p className="mt-1 text-orange-700 dark:text-orange-300">Sin centros compatibles.</p> : <ul className="mt-1 list-inside list-disc text-xs">{centers.map(id => <li key={id}>{names.get(id) ?? "Centro #" + id}</li>)}</ul>}{error && <p className="mt-1 text-xs text-orange-700 dark:text-orange-300">{error}</p>}</section>
        {worker.profile.availability && <section><h3 className="font-semibold">Nota de disponibilidad</h3><p className="mt-1 text-xs text-muted-foreground">{worker.profile.availability}</p></section>}
        <p>Horas contratadas al mes <strong>{worker.monthly_hours}</strong></p>
    </div>;
}
