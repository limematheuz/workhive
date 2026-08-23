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
        <>
            <div>
                <h3 className="text-sm font-bold text-[var(--text-main)]">1. Información y acceso</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Solo nombre, dirección y ciudad son obligatorios. El resto se puede completar más adelante.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="location-workspace-name">Nombre *</Label><Input id="location-workspace-name" value={name} onChange={(event) => setName(event.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="location-workspace-client">Cliente</Label><select id="location-workspace-client" value={clientId} onChange={(event) => setClientId(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-main)]"><option value="">Sin cliente vinculado</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="location-workspace-address">Dirección *</Label><Input id="location-workspace-address" value={address} onChange={(event) => setAddress(event.target.value)} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="location-workspace-city">Ciudad *</Label><Input id="location-workspace-city" value={city} onChange={(event) => setCity(event.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="location-workspace-postal-code">Código postal</Label><Input id="location-workspace-postal-code" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} /></div>
            </div>

            <div className="space-y-3 border-t border-[var(--border-soft)] pt-4">
                <div><p className="text-sm font-semibold text-[var(--text-main)]">Acceso a la ubicación <span className="font-normal text-[var(--text-muted)]">(opcional)</span></p><p className="mt-1 text-xs text-[var(--text-muted)]">El código se cifra y nunca vuelve a mostrarse en texto plano.</p></div>
                <div className="flex flex-wrap gap-1.5">{WEEKDAYS.map(([day, label]) => <button key={day} type="button" onClick={() => toggleDay(day)} className={`h-8 w-8 rounded-full text-xs font-bold ${access.permitted_days.includes(day) ? "bg-accent text-white" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}`}>{label}</button>)}</div>
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5"><Label htmlFor="access-from">Desde</Label><Input id="access-from" type="time" value={access.permitted_from || ""} onChange={(event) => setAccess({ ...access, permitted_from: event.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="access-until">Hasta</Label><Input id="access-until" type="time" value={access.permitted_until || ""} onChange={(event) => setAccess({ ...access, permitted_until: event.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="access-method">Método</Label><Input id="access-method" value={access.access_method || ""} onChange={(event) => setAccess({ ...access, access_method: event.target.value })} placeholder="Ej.: Recepción" /></div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5"><Label htmlFor="access-code">Código de acceso</Label><Input id="access-code" type="password" value={access.access_code} onChange={(event) => setAccess({ ...access, access_code: event.target.value, clear_access_code: false })} placeholder={hasStoredAccessCode ? "Código guardado" : "Opcional"} /></div>
                    <label className="flex items-center gap-2 self-end pb-2 text-xs text-[var(--text-muted)]"><input type="checkbox" checked={access.requires_outside_hours_authorization === true} onChange={(event) => setAccess({ ...access, requires_outside_hours_authorization: event.target.checked })} className="h-4 w-4 accent-accent" /> Requiere autorización fuera de horario</label>
                </div>
                {hasStoredAccessCode && <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]"><input type="checkbox" checked={access.clear_access_code} onChange={(event) => setAccess({ ...access, clear_access_code: event.target.checked, access_code: "" })} className="h-4 w-4 accent-accent" /> Borrar el código guardado</label>}
                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5"><Label htmlFor="access-keys-location">Dónde están las llaves</Label><Input id="access-keys-location" value={access.keys_location || ""} onChange={(event) => setAccess({ ...access, keys_location: event.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="access-key-custodian">Responsable de las llaves</Label><Input id="access-key-custodian" value={access.key_custodian || ""} onChange={(event) => setAccess({ ...access, key_custodian: event.target.value })} /></div>
                    <div className="space-y-1.5"><Label htmlFor="access-keys-available">Llaves disponibles</Label><select id="access-keys-available" value={access.keys_available === null ? "" : access.keys_available ? "yes" : "no"} onChange={(event) => setAccess({ ...access, keys_available: event.target.value === "" ? null : event.target.value === "yes" })} className="h-10 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] px-3 text-sm text-[var(--text-main)]"><option value="">Sin indicar</option><option value="yes">Sí</option><option value="no">No</option></select></div>
                </div>
                <div className="space-y-1.5"><Label htmlFor="access-instructions">Instrucciones de acceso</Label><textarea id="access-instructions" value={access.instructions || ""} onChange={(event) => setAccess({ ...access, instructions: event.target.value })} className="min-h-20 w-full rounded-lg border border-[var(--border-soft)] bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-main)]" /></div>
            </div>
        </>
    );
}
