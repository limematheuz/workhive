"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, CalendarClock, ClipboardList, Loader2, MapPin, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { ActionPopover } from "@/components/ui/action-popover";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/form-select";
import { DataTablePagination, useDataTablePagination } from "@/components/ui/data-table-pagination";
import { SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { FinanceMetricButton } from "@/components/finance/FinanceMetricButton";
import { partnerRequestPending, upcomingPartnerRequests, portalTextMatches } from "@/lib/portal-attention";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useUser } from "@/lib/user-context";
import { PartnerPortalService } from "@/services/partner-portal.service";
import type { Location } from "@/types/location";
import type { Reservation } from "@/types/reservation";
import type { PartnerPortalOverview } from "@/types/partner-portal";
import { RequestDialog } from "./PartnerPortalRequestDialog";
import { PropertyDialog } from "./PartnerPortalPropertyDialog";

export type PartnerPortalTab = "overview" | "properties" | "requests" | "profile";
type PortalReservation = Reservation & { portalDisplayCheckOut: string };

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
    const className = completed
        ? "border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)]"
        : cancelled
            ? "border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] text-[var(--btn-cancel-text)]"
            : "border-accent/25 bg-accent/10 text-accent";

    return <Badge className={`text-[10px] font-semibold uppercase tracking-wide ${className}`}>{CLEANING_STATUS[status ?? ""] ?? "Enviada"}</Badge>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
    return <Card><CardContent className="py-10 text-center"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p></CardContent></Card>;
}

function RequestsTable({ reservations, locations, onEdit, onDelete }: { reservations: PortalReservation[]; locations: Location[]; onEdit?: (reservation: PortalReservation) => void; onDelete?: (reservation: PortalReservation) => void }) {
    const pagination = useDataTablePagination(reservations, 10, "partner.requests");
    if (reservations.length === 0) return <EmptyState title="No hay solicitudes en esta selección" description="Modifica los filtros o crea una solicitud para tu propiedad." />;

    const locationNames = new Map(locations.map((location) => [location.id, location.name]));
    const locationName = (reservation: PortalReservation) => locationNames.get(reservation.location_id) ?? `Propiedad #${reservation.location_id}`;

    return <>
        <div className="hidden md:block [&_[data-slot=table-container]]:overflow-x-hidden">
            <Table className="table-fixed text-left">
                <TableHeader><TableRow className="bg-[var(--bg-secondary)]/40 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]"><TableHead className="w-[34%] text-[var(--btn-secondary-text)]">Propiedad</TableHead><TableHead className="w-[28%] text-[var(--btn-secondary-text)]">Salida</TableHead><TableHead className="w-[20%] text-[var(--btn-secondary-text)]">Estado</TableHead><TableHead className="w-[10%] text-right text-[var(--btn-secondary-text)]">Huéspedes</TableHead>{onEdit && <TableHead className="w-[8%] text-right text-[var(--btn-secondary-text)]">Acciones</TableHead>}</TableRow></TableHeader>
                <TableBody>{pagination.pageItems.map(reservation => <TableRow key={reservation.id} className="bg-[var(--bg-secondary)]/20 hover:bg-[var(--bg-secondary)]/55"><TableCell className="truncate font-semibold text-[var(--text-main)]">{locationName(reservation)}</TableCell><TableCell className="text-xs text-[var(--text-muted)]">{reservation.portalDisplayCheckOut}</TableCell><TableCell><RequestStatus status={reservation.cleaning_status} /></TableCell><TableCell className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{reservation.guest_count}</TableCell>{onEdit && <TableCell className="text-right"><ActionPopover triggerLabel={`Acciones para ${locationName(reservation)}`} options={[{ label: "Editar", icon: Pencil, variant: "edit", onClick: () => onEdit(reservation) }, { label: "Eliminar", icon: Trash2, variant: "delete", onClick: () => onDelete?.(reservation) }]} /></TableCell>}</TableRow>)}</TableBody>
            </Table>
        </div>
        <div className="grid gap-2.5 md:hidden">{pagination.pageItems.map(reservation => <Card key={reservation.id}><CardContent className="space-y-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{locationName(reservation)}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Salida: {reservation.portalDisplayCheckOut}</p></div><div className="flex shrink-0 items-center gap-1"><RequestStatus status={reservation.cleaning_status} />{onEdit && <ActionPopover triggerLabel={`Acciones para ${locationName(reservation)}`} options={[{ label: "Editar", icon: Pencil, variant: "edit", onClick: () => onEdit(reservation) }, { label: "Eliminar", icon: Trash2, variant: "delete", onClick: () => onDelete?.(reservation) }]} />}</div></div><div className="flex items-center justify-between border-t border-[var(--border-soft)] pt-3 text-sm"><span className="text-[var(--text-muted)]">Huéspedes</span><span className="font-mono font-semibold text-[var(--text-main)]">{reservation.guest_count}</span></div></CardContent></Card>)}</div>
        <DataTablePagination page={pagination.page} totalItems={reservations.length} pageSize={pagination.pageSize} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} summary={`${(pagination.page-1)*pagination.pageSize+1}–${Math.min(pagination.page*pagination.pageSize,reservations.length)} de ${reservations.length} solicitudes`} rowsPerPageLabel="Filas por página" previousLabel="Página anterior" nextLabel="Página siguiente" />
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
    const [propertyDialogOpen, setPropertyDialogOpen] = useState(false);
    const [requestDialogOpen, setRequestDialogOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    const [editingReservation, setEditingReservation] = useState<PortalReservation | null>(null);
    const [deletingLocation, setDeletingLocation] = useState<Location | null>(null);
    const [deletingReservation, setDeletingReservation] = useState<PortalReservation | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [portalOpenedAt] = useState(() => Date.now());
    const [search,setSearch]=useState("");
    const [requestFilter,setRequestFilter]=useState("all");
    const [propertiesActive,setPropertiesActive]=useState(false);
    const initialLoadStartedRef = useRef(false);
    const loadPromiseRef = useRef<Promise<void> | null>(null);

    const load = useCallback(async () => {
        if (loadPromiseRef.current) return loadPromiseRef.current;

        setLoading(true);
        setError(null);
        const request = Promise.all([PartnerPortalService.getOverview(), PartnerPortalService.getLocations(), PartnerPortalService.getReservations()]).then(([nextOverview, nextLocations, nextReservations]) => {
            setOverview(nextOverview);
            setLocations(nextLocations);
            setReservations(nextReservations.map(toPortalReservation));
        });
        loadPromiseRef.current = request;
        try {
            await request;
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "No se pudo cargar el portal.");
        } finally {
            if (loadPromiseRef.current === request) loadPromiseRef.current = null;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (initialLoadStartedRef.current) return;
        initialLoadStartedRef.current = true;
        void load();
    }, [load]);

    const upcomingReservations = useMemo(() => upcomingPartnerRequests(reservations, portalOpenedAt), [portalOpenedAt, reservations]);
    const pendingCleaningCount = useMemo(() => reservations.filter(partnerRequestPending).length, [reservations]);
    const changeTab = (tab: PartnerPortalTab) => { setActiveTab(tab); setSearch(""); setRequestFilter("all"); setPropertiesActive(false); };
    const visibleLocations=locations.filter(location=>(!propertiesActive||location.is_active)&&portalTextMatches(search,[location.name,location.address,location.city]));
    const locationNames=new Map(locations.map(location=>[location.id,location.name]));
    const visibleReservations=reservations.filter(reservation=>(requestFilter==="all"||(requestFilter==="pending"?partnerRequestPending(reservation):reservation.cleaning_status===requestFilter))&&portalTextMatches(search,[locationNames.get(reservation.location_id),String(reservation.id)])).sort((first,second)=>Date.parse(first.check_out_at)-Date.parse(second.check_out_at));
    const showRequests=(filter:string)=>{setActiveTab("requests");setRequestFilter(filter);setSearch("");};
    const handleLocationCreated = (location: Location) => {
        setLocations(current => [location, ...current]);
        setOverview(current => current ? { ...current, location_count: current.location_count + 1 } : current);
    };
    const handleLocationSaved = (location: Location, isNew: boolean) => {
        if (isNew) handleLocationCreated(location);
        else setLocations((current) => current.map((item) => item.id === location.id ? location : item));
        setEditingLocation(null);
    };
    const handleReservationSaved = (reservation: Reservation, isNew: boolean) => {
        const next = toPortalReservation(reservation);
        setReservations((current) => isNew ? [next, ...current] : current.map((item) => item.id === next.id ? next : item));
        setEditingReservation(null);
    };
    const deleteLocation = async () => {
        if (!deletingLocation) return;
        try {
            setDeleting(true);
            await PartnerPortalService.deleteLocation(deletingLocation.id);
            setLocations((current) => current.filter((location) => location.id !== deletingLocation.id));
            setOverview((current) => current ? { ...current, location_count: Math.max(0, current.location_count - 1) } : current);
            setDeletingLocation(null);
            toast.success("Propiedad eliminada.");
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "No se pudo eliminar la propiedad.");
        } finally {
            setDeleting(false);
        }
    };
    const deleteReservation = async () => {
        if (!deletingReservation) return;
        try {
            setDeleting(true);
            await PartnerPortalService.deleteReservation(deletingReservation.id);
            setReservations((current) => current.filter((reservation) => reservation.id !== deletingReservation.id));
            setDeletingReservation(null);
            toast.success("Solicitud eliminada.");
        } catch (cause) {
            toast.error(cause instanceof Error ? cause.message : "No se pudo eliminar la solicitud.");
        } finally {
            setDeleting(false);
        }
    };

    if (loading) return <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="size-7 animate-spin text-accent" /><span className="sr-only">Cargando portal</span></div>;
    if (error) return <div className="mx-auto max-w-xl px-[3%] py-8"><EmptyState title="No se pudo abrir el portal" description={error} /><div className="mt-4 text-center"><Button type="button" variant="outline" onClick={() => void load()}>Reintentar</Button></div></div>;

    return <div className="mx-auto max-w-6xl space-y-5 px-[3%] py-6 pb-12 md:p-8">
        <header className="billing-surface billing-surface-accent-pad rounded-[24px]"><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">Portal de colaboradores</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{overview?.partner_company_name ?? "Tus propiedades"}</h1><p className="mt-2 text-sm text-[var(--text-muted)]">Solicita limpiezas a {overview?.host_company_name ?? "tu proveedor"} sin acceder a su espacio de trabajo.</p></div></header>
        <PremiumTabs tabs={PARTNER_PORTAL_TABS} activeTab={activeTab} onChange={changeTab} mobileLabel="Sección del portal" />
        {activeTab === "overview" && <section className="space-y-4"><SummaryMetricGrid desktopColumns={3}><FinanceMetricButton label="Solicitudes por confirmar" value={String(reservations.filter(item=>item.cleaning_status==="requested").length)} description="Tu proveedor tiene el siguiente paso" icon={CalendarClock} attention={reservations.some(item=>item.cleaning_status==="requested")} onClick={()=>showRequests("requested")}/><FinanceMetricButton label="Limpiezas pendientes" value={String(pendingCleaningCount)} description="Solicitudes que aún no están completadas ni canceladas" icon={ClipboardList} onClick={()=>showRequests("pending")}/><Button variant="outline" className="col-span-2 h-auto min-h-0 w-full justify-start gap-3 whitespace-normal rounded-xl p-4 text-left lg:hidden" aria-label={`Propiedades activas: ${locations.filter(item=>item.is_active).length}. Tus propiedades disponibles · ver registros`} onClick={()=>{setActiveTab("properties");setPropertiesActive(true);setSearch("");}}><MapPin className="size-5 shrink-0 text-accent" aria-hidden="true"/><span className="min-w-0 flex-1"><span className="block text-sm font-medium">Propiedades activas</span><span className="mt-1 block text-xs text-muted-foreground">Tus propiedades disponibles · ver registros</span></span><strong className="text-2xl font-semibold tabular-nums text-accent">{locations.filter(item=>item.is_active).length}</strong></Button><div className="hidden lg:block"><FinanceMetricButton label="Propiedades activas" value={String(locations.filter(item=>item.is_active).length)} description="Tus propiedades disponibles · ver registros" icon={MapPin} onClick={()=>{setActiveTab("properties");setPropertiesActive(true);setSearch("");}}/></div></SummaryMetricGrid><Card><CardContent><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Próximas solicitudes</h2><p className="mt-1 text-sm text-muted-foreground">Ordenadas por salida. Tu proveedor confirma el horario del servicio.</p></div><Button variant="outline" size="sm" onClick={()=>showRequests("all")}>Ver solicitudes</Button></div><RequestsTable reservations={upcomingReservations.slice(0,5)} locations={locations}/></CardContent></Card></section>}
        {(activeTab==="properties"||activeTab==="requests")&&<section className="billing-surface flex flex-wrap items-center gap-3 rounded-xl p-3"><Input aria-label={activeTab==="properties"?"Buscar propiedad":"Buscar solicitud"} placeholder={activeTab==="properties"?"Nombre o dirección de la propiedad…":"Propiedad o número de solicitud…"} value={search} onChange={event=>setSearch(event.target.value)} className="min-w-48 flex-1"/>{activeTab==="requests"&&<FormSelect aria-label="Estado de la solicitud" value={requestFilter} onValueChange={setRequestFilter}><option value="all">Todas las solicitudes</option><option value="requested">Por confirmar</option><option value="pending">Limpiezas pendientes</option><option value="scheduled">Programadas</option><option value="in_progress">En curso</option><option value="completed">Completadas</option><option value="cancelled">Canceladas</option></FormSelect>}{(search||requestFilter!=="all"||propertiesActive)&&<Button size="sm" variant="ghost" onClick={()=>{setSearch("");setRequestFilter("all");setPropertiesActive(false);}}>Mostrar todos</Button>}{propertiesActive&&<p className="text-xs text-muted-foreground">Sólo propiedades activas</p>}</section>}
        {activeTab === "properties" && <section className="space-y-4"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Tus propiedades</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Solo tú gestionas estas propiedades. Tu proveedor asignado recibe el trabajo de limpieza.</p></div><Button type="button" onClick={() => { setEditingLocation(null); setPropertyDialogOpen(true); }}><Plus className="size-4" />Nueva propiedad</Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{visibleLocations.length === 0 ? <div className="sm:col-span-2 lg:col-span-3"><EmptyState title={locations.length?"No hay propiedades para esta selección":"Aún no tienes propiedades"} description={locations.length?"Modifica la búsqueda o muestra todos los registros.":"Crea una propiedad para empezar a solicitar limpiezas."} /></div> : visibleLocations.map(location => <Card key={location.id}><CardContent><div className="flex items-start justify-between gap-3"><MapPin className="size-5 shrink-0 text-accent" /><ActionPopover triggerLabel={`Acciones para ${location.name}`} options={[{ label: "Editar", icon: Pencil, variant: "edit", onClick: () => { setEditingLocation(location); setPropertyDialogOpen(true); } }, { label: "Eliminar", icon: Trash2, variant: "delete", onClick: () => setDeletingLocation(location) }]} /></div><h2 className="mt-4 font-semibold">{location.name}</h2><p className="mt-1 text-sm text-[var(--text-muted)]">{[location.address, location.postal_code, location.city].filter(Boolean).join(", ") || "Dirección no informada"}</p><p className="mt-4 text-xs font-medium text-[var(--text-muted)]">{location.is_active ? "Activa" : "Inactiva"}</p></CardContent></Card>)}</div></section>}
        {activeTab === "requests" && <Card><CardContent><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h2 className="font-semibold">Solicitudes de limpieza</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Cada salida genera una petición para tu proveedor asignado.</p></div><Button type="button" onClick={() => { setEditingReservation(null); setRequestDialogOpen(true); }} disabled={locations.length === 0}><Plus className="size-4" />Nueva solicitud</Button></div><RequestsTable reservations={visibleReservations} locations={locations} onEdit={(reservation) => { setEditingReservation(reservation); setRequestDialogOpen(true); }} onDelete={setDeletingReservation} /></CardContent></Card>}
        {activeTab === "profile" && <Card><CardContent className="space-y-5"><div className="flex items-center gap-3"><UserRound className="size-8 text-accent" /><div><h2 className="font-semibold">{user?.full_name || "Usuario"}</h2><p className="text-sm text-[var(--text-muted)]">{user?.email}</p></div></div><div className="border-t border-[var(--border-soft)] pt-4 text-sm text-[var(--text-muted)]"><p>Este acceso está patrocinado por {overview?.host_company_name ?? "tu empresa anfitriona"}. Solo incluye tus propiedades y solicitudes de limpieza.</p></div></CardContent></Card>}
        <PropertyDialog location={editingLocation} open={propertyDialogOpen} onOpenChange={(open) => { setPropertyDialogOpen(open); if (!open) setEditingLocation(null); }} onSaved={handleLocationSaved} />
        {requestDialogOpen && <RequestDialog reservation={editingReservation} locations={locations} open={requestDialogOpen} onOpenChange={(open) => { setRequestDialogOpen(open); if (!open) setEditingReservation(null); }} onSaved={handleReservationSaved} />}
        <DeleteConfirmDialog open={Boolean(deletingLocation)} onOpenChange={(open) => { if (!open) setDeletingLocation(null); }} title="¿Eliminar propiedad?" description="La propiedad se archivará y no admitirá nuevas solicitudes. Se conservarán los registros existentes." onConfirm={() => void deleteLocation()} isDeleting={deleting} confirmText="Eliminar propiedad" cancelText="Cancelar" />
        <DeleteConfirmDialog open={Boolean(deletingReservation)} onOpenChange={(open) => { if (!open) setDeletingReservation(null); }} title="¿Eliminar solicitud?" description="La solicitud de limpieza y su trabajo asociado se eliminarán si aún no se han iniciado." onConfirm={() => void deleteReservation()} isDeleting={deleting} confirmText="Eliminar solicitud" cancelText="Cancelar" />
    </div>;
}
