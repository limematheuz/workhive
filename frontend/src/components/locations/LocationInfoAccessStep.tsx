import { Building2, CalendarClock, KeyRound, Network, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { LocationInfoAccessStepProps } from "./location-workspace-types";

const WEEKDAYS = [
    ["mon", "L"], ["tue", "M"], ["wed", "X"], ["thu", "J"],
    ["fri", "V"], ["sat", "S"], ["sun", "D"],
] as const;

export function LocationInfoAccessStep({
    clients,
    showClientAssignment = true,
    name,
    address,
    city,
    postalCode,
    clientId,
    departments,
    teams,
    organizationAssignmentAvailable,
    departmentId,
    teamId,
    access,
    hasStoredAccessCode,
    setName,
    setAddress,
    setCity,
    setPostalCode,
    setClientId,
    setDepartmentId,
    setTeamId,
    setAccess,
}: LocationInfoAccessStepProps) {
    const activeDepartments = departments.filter((department) => department.is_active);
    const availableTeams = teams.filter(
        (team) => team.is_active && team.department_id != null && (
            !departmentId || team.department_id === Number(departmentId)
        ),
    );

    const changeDepartment = (value: string) => {
        const nextDepartmentId = value === "none" ? "" : value;
        setDepartmentId(nextDepartmentId);
        if (
            teamId
            && teams.find((team) => team.id === Number(teamId))?.department_id !== Number(nextDepartmentId)
        ) {
            setTeamId("");
        }
    };

    const changeTeam = (value: string) => {
        const nextTeamId = value === "none" ? "" : value;
        setTeamId(nextTeamId);
        const team = teams.find((item) => item.id === Number(nextTeamId));
        if (team?.department_id) setDepartmentId(String(team.department_id));
    };

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
                    {showClientAssignment && <div className="space-y-1.5"><Label htmlFor="location-workspace-client">Cliente</Label><Select value={clientId || "none"} onValueChange={(value) => setClientId(value === "none" ? "" : value)}><SelectTrigger id="location-workspace-client"><SelectValue placeholder="Sin cliente vinculado" /></SelectTrigger><SelectContent><SelectItem value="none">Sin cliente vinculado</SelectItem>{clients.map((client) => <SelectItem key={client.id} value={String(client.id)}>{client.name}</SelectItem>)}</SelectContent></Select></div>}
                    <div className="space-y-1.5 lg:col-span-2"><Label htmlFor="location-workspace-address">Dirección *</Label><Input id="location-workspace-address" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Calle, número, código postal, ciudad" /></div>
                    <div className="space-y-1.5"><Label htmlFor="location-workspace-city">Ciudad *</Label><Input id="location-workspace-city" value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ej.: Barcelona" /></div>
                    <div className="space-y-1.5"><Label htmlFor="location-workspace-postal-code">Código postal</Label><Input id="location-workspace-postal-code" value={postalCode} onChange={(event) => setPostalCode(event.target.value)} placeholder="Ej.: 08018" /></div>
                </div>
            </section>

            {organizationAssignmentAvailable && <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-4 sm:p-5">
                <div className="mb-4"><div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]"><Network className="h-4 w-4 text-accent" /> Organización operativa <span className="font-normal text-[var(--text-muted)]">(opcional)</span></div><p className="mt-1 text-xs text-[var(--text-muted)]">Los trabajos heredan este ámbito. Un equipo asignado determina su departamento.</p></div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5"><Label htmlFor="location-workspace-department">Departamento</Label><Select value={departmentId || "none"} onValueChange={changeDepartment}><SelectTrigger id="location-workspace-department"><SelectValue placeholder="Sin departamento" /></SelectTrigger><SelectContent><SelectItem value="none">Sin departamento</SelectItem>{activeDepartments.map((department) => <SelectItem key={department.id} value={String(department.id)}>{department.name}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1.5"><Label htmlFor="location-workspace-team">Equipo</Label><Select value={teamId || "none"} onValueChange={changeTeam}><SelectTrigger id="location-workspace-team"><SelectValue placeholder="Sin equipo" /></SelectTrigger><SelectContent><SelectItem value="none">Sin equipo</SelectItem>{availableTeams.map((team) => <SelectItem key={team.id} value={String(team.id)}>{team.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
            </section>}

            <section className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-4 sm:p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]"><KeyRound className="h-4 w-4 text-accent" /> Acceso a la ubicación <span className="font-normal text-[var(--text-muted)]">(opcional)</span></div><p className="mt-1 text-xs text-[var(--text-muted)]">El código se cifra y nunca vuelve a mostrarse en texto plano.</p></div><span className="inline-flex items-center gap-1 rounded-lg bg-accent/10 px-2 py-1 text-[10px] font-semibold text-accent"><ShieldCheck className="h-3 w-3" /> Información protegida</span></div>
                <div className="space-y-4">
                    <div><Label className="mb-2 block">Horario permitido</Label><div className="flex flex-wrap items-center gap-2"><div className="flex gap-1.5">{WEEKDAYS.map(([day, label]) => { const selected = access.permitted_days.includes(day); return <Button key={day} type="button" variant={selected ? "default" : "outline"} size="icon-xs" aria-pressed={selected} onClick={() => toggleDay(day)} className="h-8 w-8 rounded-full text-xs font-bold">{label}</Button>; })}</div><span className="hidden h-5 w-px bg-[var(--border-soft)] sm:block" /><CalendarClock className="h-4 w-4 text-[var(--text-muted)]" /><span className="text-xs text-[var(--text-muted)]">Selecciona los días de acceso permitidos.</span></div></div>
                    <div className="grid gap-4 md:grid-cols-3"><div className="space-y-1.5"><Label htmlFor="access-from">Desde</Label><Input id="access-from" type="time" value={access.permitted_from || ""} onChange={(event) => setAccess({ ...access, permitted_from: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="access-until">Hasta</Label><Input id="access-until" type="time" value={access.permitted_until || ""} onChange={(event) => setAccess({ ...access, permitted_until: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="access-method">Método de acceso</Label><Input id="access-method" value={access.access_method || ""} onChange={(event) => setAccess({ ...access, access_method: event.target.value })} placeholder="Ej.: Recepción" /></div></div>
                    <div className="grid gap-4 md:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="access-code">Código de acceso</Label><Input id="access-code" type="password" value={access.access_code} onChange={(event) => setAccess({ ...access, access_code: event.target.value, clear_access_code: false })} placeholder={hasStoredAccessCode ? "Código guardado" : "Opcional"} /></div><div className="flex items-center gap-3 self-end pb-2"><Checkbox id="outside-hours-authorization" checked={access.requires_outside_hours_authorization === true} onCheckedChange={(checked) => setAccess({ ...access, requires_outside_hours_authorization: checked === true })} /><Label htmlFor="outside-hours-authorization" className="cursor-pointer text-sm font-medium text-[var(--text-main)]">Requiere autorización fuera de horario</Label></div></div>
                    {hasStoredAccessCode && <div className="flex items-center gap-3"><Checkbox id="clear-access-code" checked={access.clear_access_code} onCheckedChange={(checked) => setAccess({ ...access, clear_access_code: checked === true, access_code: "" })} /><Label htmlFor="clear-access-code" className="cursor-pointer text-sm font-medium text-[var(--text-main)]">Borrar el código guardado</Label></div>}
                    <div className="grid gap-4 md:grid-cols-3"><div className="space-y-1.5"><Label htmlFor="access-keys-location">Dónde están las llaves</Label><Input id="access-keys-location" value={access.keys_location || ""} onChange={(event) => setAccess({ ...access, keys_location: event.target.value })} placeholder="Ej.: Recepción" /></div><div className="space-y-1.5"><Label htmlFor="access-key-custodian">Responsable de las llaves</Label><Input id="access-key-custodian" value={access.key_custodian || ""} onChange={(event) => setAccess({ ...access, key_custodian: event.target.value })} /></div><div className="space-y-1.5"><Label htmlFor="access-keys-available">Llaves disponibles</Label><Select value={access.keys_available === null ? "unknown" : access.keys_available ? "yes" : "no"} onValueChange={(value) => setAccess({ ...access, keys_available: value === "unknown" ? null : value === "yes" })}><SelectTrigger id="access-keys-available"><SelectValue placeholder="Sin indicar" /></SelectTrigger><SelectContent><SelectItem value="unknown">Sin indicar</SelectItem><SelectItem value="yes">Sí</SelectItem><SelectItem value="no">No</SelectItem></SelectContent></Select></div></div>
                    <div className="space-y-1.5"><Label htmlFor="access-instructions">Instrucciones de acceso</Label><Textarea id="access-instructions" value={access.instructions || ""} onChange={(event) => setAccess({ ...access, instructions: event.target.value })} placeholder="Ej.: Llamar a recepción y usar el ascensor de carga." className="min-h-24 rounded-xl bg-[var(--bg-primary)] p-3 text-sm text-[var(--text-main)] focus:border-accent/50" /></div>
            </div>
            </section>
        </div>
    );
}
