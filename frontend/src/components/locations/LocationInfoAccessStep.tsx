import { Building2, CalendarClock, KeyRound, MapPin, ShieldCheck } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LocationInfoAccessStepProps } from "./location-workspace-types";

const WEEKDAYS = [
    ["mon", "L"], ["tue", "M"], ["wed", "X"], ["thu", "J"],
    ["fri", "V"], ["sat", "S"], ["sun", "D"],
] as const;

export function LocationInfoAccessStep({
    clients,
    name,
    address,
    city,
    postalCode,
    clientId,
    access,
    hasStoredAccessCode,
    setName,
    setAddress,
    setCity,
    setPostalCode,
    setClientId,
    setAccess,
}: LocationInfoAccessStepProps) {
    const toggleDay = (day: typeof WEEKDAYS[number][0]) => {
        setAccess({
            ...access,
            permitted_days: access.permitted_days.includes(day)
                ? access.permitted_days.filter((currentDay) => currentDay !== day)
                : [...access.permitted_days, day],
        });
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-bold text-[var(--text-main)]">1. Información y acceso</h3>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Empieza por los datos básicos. Solo nombre, dirección y ciudad son obligatorios.</p>
            </div>
            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-4 sm:p-5">
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]"><Building2 className="h-4 w-4 text-accent" /> Información de la ubicación</div>
                <div className="grid gap-4 lg:grid-cols-2">
                    <div className="space-y-1.5"><Label htmlFor="location-workspace-name">Nombre *</Label><Input id="location-workspace-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ej.: Oficina Barcelona" /></div>
                    <div className="space-y-1.5"><Label htmlFor="location-workspace-client">Cliente</Label><select id="location-workspace-client" value={clientId} onChange={(event) => setClientId(event.target.value)} className="h-10 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-main)]"><option value="">Sin cliente vinculado</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
                    <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="location-workspace-address">Dirección *</Label><div className="relative"><MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent" /><Input id="location-workspace-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Calle, número, código postal, ciudad" className="pl-9" /></div></div>
                    <div className="space-y-1.5"><Label htmlFor="location-workspace-city">Ciudad *</Label><Input id="location-workspace-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ej.: Barcelona" /></div>
                    <div className="space-y-1.5"><Label htmlFor="location-workspace-postal-code">Código postal</Label><Input id="location-workspace-postal-code" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="Ej.: 08018" /></div>
                </div>
            </section>

            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]"><KeyRound className="h-4 w-4 text-accent" /> Acceso a la ubicación <span className="font-normal text-[var(--text-muted)]">(opcional)</span></div><p className="mt-1 text-xs text-[var(--text-muted)]">El código se cifra y nunca vuelve a mostrarse en texto plano.</p></div><span className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent"><ShieldCheck className="h-3 w-3" /> Información protegida</span></div>
                <div className="space-y-4">
                    <div><Label className="mb-2 block">Horario permitido</Label><div className="flex flex-wrap items-center gap-2"><div className="flex gap-1.5">{WEEKDAYS.map(([day, label]) => <button key={day} type="button" aria-pressed={access.permitted_days.includes(day)} onClick={() => toggleDay(day)} className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${access.permitted_days.includes(day) ? "bg-accent text-white" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)] hover:bg-accent/10 hover:text-accent"}`}>{label}</button>)}</div><span className="hidden h-5 w-px bg-[var(--border-soft)] sm:block" /><CalendarClock className="h-4 w-4 text-[var(--text-muted)]" /><span className="text-xs text-[var(--text-muted)]">Selecciona los días de acceso permitidos.</span></div></div>
                    <div className="grid gap-4 md:grid-cols-3"><div className="space-y-1.5"><Label htmlFor="access-from">Desde</Label><Input id="access-from" type="time" value={access.permitted_from || ""} onChange={(event) => setAccess({ ...access, permitted_from: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="access-until">Hasta</Label><Input id="access-until" type="time" value={access.permitted_until || ""} onChange={(event) => setAccess({ ...access, permitted_until: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="access-method">Método de acceso</Label><Input id="access-method" value={access.access_method || ""} onChange={(event) => setAccess({ ...access, access_method: event.target.value })} placeholder="Ej.: Recepción" /></div></div>
                    <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="access-code">Código de acceso</Label><Input id="access-code" type="password" value={access.access_code} onChange={(event) => setAccess({ ...access, access_code: event.target.value, clear_access_code: false })} placeholder={hasStoredAccessCode ? "Código guardado" : "Opcional"} /></div><label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm text-[var(--text-main)]"><Checkbox checked={access.requires_outside_hours_authorization === true} onCheckedChange={(checked) => setAccess({ ...access, requires_outside_hours_authorization: checked === true })} /> Requiere autorización fuera de horario</label></div>
                    {hasStoredAccessCode && <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text-main)]"><Checkbox checked={access.clear_access_code} onCheckedChange={(checked) => setAccess({ ...access, clear_access_code: checked === true, access_code: "" })} /> Borrar el código guardado</label>}
                    <div className="grid gap-4 md:grid-cols-3"><div className="space-y-1.5"><Label htmlFor="access-keys-location">Dónde están las llaves</Label><Input id="access-keys-location" value={access.keys_location || ""} onChange={(event) => setAccess({ ...access, keys_location: event.target.value })} placeholder="Ej.: Recepción" /></div><div className="space-y-1.5"><Label htmlFor="access-key-custodian">Responsable de las llaves</Label><Input id="access-key-custodian" value={access.key_custodian || ""} onChange={(event) => setAccess({ ...access, key_custodian: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="access-keys-available">Llaves disponibles</Label><select id="access-keys-available" value={access.keys_available === null ? "" : access.keys_available ? "yes" : "no"} onChange={(event) => setAccess({ ...access, keys_available: event.target.value === "" ? null : event.target.value === "yes" })} className="h-10 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-main)]"><option value="">Sin indicar</option><option value="yes">Sí</option><option value="no">No</option></select></div></div>
                    <div className="space-y-1.5"><Label htmlFor="access-instructions">Instrucciones de acceso</Label><textarea id="access-instructions" value={access.instructions || ""} onChange={(event) => setAccess({ ...access, instructions: event.target.value })} placeholder="Ej.: Llamar a recepción y usar el ascensor de carga." className="min-h-24 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-main)] outline-none focus:border-accent/50" /></div>
            </div>
            </section>
        </div>
    );
}
