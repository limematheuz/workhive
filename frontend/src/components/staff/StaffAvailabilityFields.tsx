"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {SearchableMultiSelect} from "@/components/ui/searchable-multi-select";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClientId } from "@/lib/editable-line-key";
import { LocationService, type Location } from "@/services/location.service";
import type { Profile } from "@/services/staff.service";
import { AVAILABILITY_TIMES, WEEKDAYS } from "@/domain/staff/staff-availability";

type AvailabilityChanges = Partial<Pick<Profile, "weekly_availability" | "compatible_location_ids">>;

export function StaffAvailabilityFields({ value, change, disabled }: { value: Profile; change: (changes: AvailabilityChanges) => void; disabled: boolean }) {
    const [locations, setLocations] = useState<Location[]>([]);
    const [error, setError] = useState("");
    useEffect(() => { let active = true; void LocationService.getLocations().then(rows => { if (active) setLocations(rows); }).catch(() => { if (active) setError("No se pudieron cargar los centros compatibles."); }); return () => { active = false; }; }, []);
    const slots = value.weekly_availability;
    const centers = value.compatible_location_ids;
    const managedLocations = useMemo(() => locations.filter(site => site.can_manage_tasks), [locations]);
    return <fieldset className="col-span-full space-y-3 rounded-xl border p-3"><legend className="px-1 font-semibold">Disponibilidad y centros compatibles</legend>
        <p className="text-xs text-muted-foreground">Franjas en la zona horaria de la empresa. Para turnos nocturnos, añade una franja hasta las 24:00 y otra al día siguiente. La nota de disponibilidad anterior se conserva como referencia.</p>
        <label className="flex items-center gap-2"><Checkbox disabled={disabled} checked={slots != null} onCheckedChange={checked => change({ weekly_availability: checked === true ? [] : null })} />Configurar disponibilidad semanal verificable</label>
        {slots == null ? <p className="text-xs text-orange-700 dark:text-orange-300">Disponibilidad sin configurar; esta persona no podrá seleccionarse desde la bolsa hasta completarla.</p> : <>
            {slots.map((slot, index) => <div key={slot._key} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <Select disabled={disabled} value={String(slot.weekday)} onValueChange={day => change({ weekly_availability: slots.map((row, position) => position === index ? { ...row, weekday: Number(day) } : row) })}><SelectTrigger aria-label="Día disponible"><SelectValue /></SelectTrigger><SelectContent>{WEEKDAYS.map((day, number) => <SelectItem key={day} value={String(number)}>{day}</SelectItem>)}</SelectContent></Select>
                <Select disabled={disabled} value={slot.starts_at} onValueChange={time => change({ weekly_availability: slots.map((row, position) => position === index ? { ...row, starts_at: time } : row) })}><SelectTrigger aria-label="Disponible desde"><SelectValue /></SelectTrigger><SelectContent>{AVAILABILITY_TIMES.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent></Select>
                <Select disabled={disabled} value={slot.ends_at} onValueChange={time => change({ weekly_availability: slots.map((row, position) => position === index ? { ...row, ends_at: time } : row) })}><SelectTrigger aria-label="Disponible hasta"><SelectValue /></SelectTrigger><SelectContent>{[...AVAILABILITY_TIMES, "24:00"].map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}</SelectContent></Select>
                <Button type="button" variant="ghost" size="icon" aria-label="Quitar franja disponible" disabled={disabled} onClick={() => change({ weekly_availability: slots.filter((_, position) => position !== index) })}><Trash2 className="size-4" /></Button>
            </div>)}
            <Button type="button" variant="outline" size="sm" disabled={disabled || slots.length >= 42} onClick={() => change({ weekly_availability: [...slots, { weekday: 0, starts_at: "08:00", ends_at: "16:00", _key: createClientId() }] })}><Plus className="size-4" />Añadir franja</Button>
            {!slots.length && <p className="text-xs text-orange-700 dark:text-orange-300">Sin franjas disponibles; no se admitirán nuevas asignaciones.</p>}
        </>}
        <label className="flex items-center gap-2"><Checkbox disabled={disabled} checked={centers != null} onCheckedChange={checked => change({ compatible_location_ids: checked === true ? [] : null })} />Configurar centros compatibles</label>
        {centers == null ? <p className="text-xs text-orange-700 dark:text-orange-300">Centros pendientes de configurar para la bolsa.</p> : <SearchableMultiSelect aria-label="Centros compatibles del trabajador" options={managedLocations.map(site=>({value:String(site.id),label:site.name,description:site.city}))} value={centers.map(String)} onValueChange={ids=>change({compatible_location_ids:ids.map(Number)})} disabled={disabled} maxSelected={500} placeholder="Buscar centros por nombre o ciudad…"/>}
        {error && <p role="alert" className="text-xs text-orange-700">{error}</p>}
    </fieldset>;
}
