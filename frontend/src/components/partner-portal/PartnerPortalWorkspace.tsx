"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Building2, CalendarClock, ClipboardList, Loader2, MapPin, Plus, Send, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/lib/user-context";
import { PartnerPortalService } from "@/services/partner-portal.service";
import type { Location } from "@/types/location";
import type { Reservation } from "@/types/reservation";
import type { PartnerPortalOverview, PartnerPortalReservationInput } from "@/types/partner-portal";

export type PartnerPortalTab = "overview" | "properties" | "requests" | "profile";
type PortalReservation = Reservation & { portalDisplayCheckOut: string };

const TAB_PATHS: Record<PartnerPortalTab, string> = {
    overview: "/dashboard/partner",
    properties: "/dashboard/partner/properties",
    requests: "/dashboard/partner/requests",
    profile: "/dashboard/partner/profile",
};

const CLEANING_STATUS: Record<string, string> = {
    requested: "Pendiente de confirmar",
    pending: "Pendiente",
    scheduled: "Programada",
    in_progress: "En curso",
    completed: "Completada",
    cancelled: "Cancelada",
};

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
});

const PARTNER_PORTAL_TABS = [
    { id: "overview" as const, label: "Resumen", icon: Building2 },
    { id: "properties" as const, label: "Propiedades", icon: MapPin },
    { id: "requests" as const, label: "Solicitudes", icon: ClipboardList },
    { id: "profile" as const, label: "Perfil", icon: UserRound },
];

function toPortalReservation(reservation: Reservation): PortalReservation {
    return {
        ...reservation,
        portalDisplayCheckOut: DATE_TIME_FORMATTER.format(new Date(reservation.check_out_at)),
    };
}

function RequestStatus({ status }: { status?: string | null }) {
    const completed = status === "completed";
    const cancelled = status === "cancelled";
    return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${completed ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : cancelled ? "border-red-500/30 bg-red-500/10 text-red-600" : "border-accent/25 bg-accent/10 text-accent"}`}>{CLEANING_STATUS[status ?? ""] ?? "Enviada"}</span>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
    return <Card><CardContent className="py-10 text-center"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p></CardContent></Card>;
}

function NewRequestDialog({ locations, onCreated }: { locations: Location[]; onCreated: (reservation: Reservation) => void }) {
    const [open, setOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({ locationId: "", checkIn: "", checkOut: "", guests: "1", reference: "", notes: "" });

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!form.locationId || !form.checkIn || !form.checkOut) {
            toast.error("Indica la propiedad y las fechas de la estancia.");
            return;
        }
        setSubmitting(true);
        try {
            const data: PartnerPortalReservationInput = {
                location_id: Number(form.locationId),
                check_in_at: new Date(form.checkIn).toISOString(),
                check_out_at: new Date(form.checkOut).toISOString(),
                guest_count: Number(form.guests) || 1,
                stay_type: "guest",
                status: "confirmed",
                source: "partner_portal",
                external_reference: form.reference.trim() || null,
                notes: form.notes.trim() || null,
            };
            const reservation = await PartnerPortalService.createReservation(data);
            onCreated(reservation);
            setOpen(false);
            setForm({ locationId: "", checkIn: "", checkOut: "", guests: "1", reference: "", notes: "" });
            toast.success("Solicitud enviada a la empresa de limpieza.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo enviar la solicitud.");
        } finally {
            setSubmitting(false);
        }
    };

    return <Dialog open={open} onOpenChange={setOpen}>
        <Button type="button" onClick={() => setOpen(true)} disabled={locations.length === 0}><Plus className="size-4" />Nueva solicitud</Button>
        <DialogContent compact className="max-w-xl">
            <DialogHeader><DialogTitle>Nueva solicitud de limpieza</DialogTitle><DialogDescription>Al guardar, se enviará una solicitud a tu empresa de limpieza asignada.</DialogDescription></DialogHeader>
            <form className="grid gap-4" onSubmit={submit}>
                <div className="grid gap-2"><Label htmlFor="partner-location">Propiedad</Label><Select value={form.locationId} onValueChange={(locationId) => setForm(current => ({ ...current, locationId }))}><SelectTrigger id="partner-location"><SelectValue placeholder="Selecciona una propiedad" /></SelectTrigger><SelectContent>{locations.map(location => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="partner-check-in">Entrada</Label><Input id="partner-check-in" type="datetime-local" value={form.checkIn} onChange={event => setForm(current => ({ ...current, checkIn: event.target.value }))} /></div><div className="grid gap-2"><Label htmlFor="partner-check-out">Salida</Label><Input id="partner-check-out" type="datetime-local" value={form.checkOut} onChange={event => setForm(current => ({ ...current, checkOut: event.target.value }))} /></div></div>
                <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="partner-guests">Huéspedes</Label><Input id="partner-guests" type="number" min="1" value={form.guests} onChange={event => setForm(current => ({ ...current, guests: event.target.value }))} /></div><div className="grid gap-2"><Label htmlFor="partner-reference">Referencia</Label><Input id="partner-reference" value={form.reference} onChange={event => setForm(current => ({ ...current, reference: event.target.value }))} placeholder="Opcional" /></div></div>
                <div className="grid gap-2"><Label htmlFor="partner-notes">Notas para la limpieza</Label><Textarea id="partner-notes" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Opcional" /></div>
                <DialogFooter className="mt-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}Enviar solicitud</Button></DialogFooter>
            </form>
        </DialogContent>
    </Dialog>;
}

function RequestsTable({ reservations }: { reservations: PortalReservation[] }) {
    if (reservations.length === 0) return <EmptyState title="Aún no hay solicitudes" description="Crea la primera estancia para solicitar su limpieza." />;
    return <>
        <div className="hidden md:block"><Table><TableHeader><TableRow><TableHead className="text-accent">Propiedad</TableHead><TableHead className="text-accent">Salida</TableHead><TableHead className="text-accent">Estado</TableHead><TableHead className="text-right text-accent">Huéspedes</TableHead></TableRow></TableHeader><TableBody>{reservations.map(reservation => <TableRow key={reservation.id}><TableCell className="font-semibold">{reservation.location_id}</TableCell><TableCell>{reservation.portalDisplayCheckOut}</TableCell><TableCell><RequestStatus status={reservation.cleaning_status} /></TableCell><TableCell className="text-right">{reservation.guest_count}</TableCell></TableRow>)}</TableBody></Table></div>
        <div className="grid gap-3 md:hidden">{reservations.map(reservation => <Card key={reservation.id}><CardContent className="space-y-3"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Propiedad #{reservation.location_id}</p><p className="mt-0.5 text-sm text-[var(--text-muted)]">Salida: {reservation.portalDisplayCheckOut}</p></div><RequestStatus status={reservation.cleaning_status} /></div><div className="flex items-center justify-between border-t border-[var(--border-soft)] pt-3 text-sm"><span className="text-[var(--text-muted)]">Huéspedes</span><span className="font-semibold">{reservation.guest_count}</span></div></CardContent></Card>)}</div>
    </>;
}

export function PartnerPortalWorkspace({ initialTab }: { initialTab: PartnerPortalTab }) {
    const { user } = useUser();
    const [activeTab, setActiveTab] = useState<PartnerPortalTab>(initialTab);
    const [overview, setOverview] = useState<PartnerPortalOverview | null>(null);
    const [locations, setLocations] = useState<Location[]>([]);
    const [reservations, setReservations] = useState<PortalReservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [nextOverview, nextLocations, nextReservations] = await Promise.all([PartnerPortalService.getOverview(), PartnerPortalService.getLocations(), PartnerPortalService.getReservations()]);
            setOverview(nextOverview);
            setLocations(nextLocations);
            setReservations(nextReservations.map(toPortalReservation));
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "No se pudo cargar el portal.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { setActiveTab(initialTab); }, [initialTab]);
    useEffect(() => { void load(); }, [load]);

    const upcomingReservations = useMemo(() => reservations.filter(reservation => new Date(reservation.check_out_at).getTime() >= Date.now()), [reservations]);
    const changeTab = (tab: PartnerPortalTab) => { setActiveTab(tab); window.location.assign(TAB_PATHS[tab]); };
    const handleCreated = (reservation: Reservation) => { setReservations(current => [toPortalReservation(reservation), ...current]); void load(); };

    if (loading) return <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="size-7 animate-spin text-accent" /><span className="sr-only">Cargando portal</span></div>;
    if (error) return <div className="mx-auto max-w-xl px-[3%] py-8"><EmptyState title="No se pudo abrir el portal" description={error} /><div className="mt-4 text-center"><Button type="button" variant="outline" onClick={() => void load()}>Reintentar</Button></div></div>;

    return <div className="mx-auto max-w-6xl space-y-5 px-[3%] py-6 pb-12 md:p-8">
        <header className="billing-surface billing-surface-accent-pad rounded-[24px]"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Portal de colaboradores</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{overview?.partner_company_name ?? "Tus propiedades"}</h1><p className="mt-2 text-sm text-[var(--text-muted)]">Solicita limpiezas a {overview?.host_company_name ?? "tu proveedor"} sin acceder a su espacio de trabajo.</p></div>{activeTab !== "profile" && <NewRequestDialog locations={locations} onCreated={handleCreated} />}</div></header>
        <PremiumTabs tabs={PARTNER_PORTAL_TABS} activeTab={activeTab} onChange={changeTab} mobileLabel="Sección del portal" />
        {activeTab === "overview" && <section className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Card><CardContent><MapPin className="mb-4 size-5 text-accent" /><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Propiedades activas</p><p className="mt-1 text-3xl font-bold">{overview?.location_count ?? 0}</p></CardContent></Card><Card><CardContent><CalendarClock className="mb-4 size-5 text-accent" /><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Próximas estancias</p><p className="mt-1 text-3xl font-bold">{overview?.upcoming_reservation_count ?? 0}</p></CardContent></Card><Card><CardContent><ClipboardList className="mb-4 size-5 text-accent" /><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Limpiezas pendientes</p><p className="mt-1 text-3xl font-bold">{overview?.pending_cleaning_count ?? 0}</p></CardContent></Card></div><Card><CardContent><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold">Próximas solicitudes</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Solo ves las limpiezas solicitadas desde tus propiedades.</p></div><Button type="button" variant="outline" onClick={() => changeTab("requests")}>Ver todas</Button></div><RequestsTable reservations={upcomingReservations.slice(0, 5)} /></CardContent></Card></section>}
        {activeTab === "properties" && <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{locations.length === 0 ? <div className="sm:col-span-2 lg:col-span-3"><EmptyState title="Aún no tienes propiedades" description="Tu empresa anfitriona puede ayudarte a configurarlas." /></div> : locations.map(location => <Card key={location.id}><CardContent><MapPin className="mb-4 size-5 text-accent" /><h2 className="font-semibold">{location.name}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{[location.address, location.postal_code, location.city].filter(Boolean).join(", ") || "Dirección no informada"}</p><p className="mt-4 text-xs font-medium text-[var(--text-muted)]">{location.is_active ? "Activa" : "Inactiva"}</p></CardContent></Card>)}</section>}
        {activeTab === "requests" && <Card><CardContent><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Solicitudes de limpieza</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Cada salida genera una petición para tu proveedor asignado.</p></div><NewRequestDialog locations={locations} onCreated={handleCreated} /></div><RequestsTable reservations={reservations} /></CardContent></Card>}
        {activeTab === "profile" && <Card><CardContent className="space-y-5"><div className="flex items-center gap-3"><UserRound className="size-8 text-accent" /><div><h2 className="font-semibold">{user?.full_name || "Usuario"}</h2><p className="text-sm text-[var(--text-muted)]">{user?.email}</p></div></div><div className="border-t border-[var(--border-soft)] pt-4 text-sm text-[var(--text-muted)]"><p>Este acceso está patrocinado por {overview?.host_company_name ?? "tu empresa anfitriona"}. Solo incluye tus propiedades y solicitudes de limpieza.</p></div></CardContent></Card>}
    </div>;
}
