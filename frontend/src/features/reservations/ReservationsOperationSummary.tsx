import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ReservationList } from "./ReservationList";
import type { Reservation } from "@/types/reservation";
import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<typeof ReservationList>, "loading"> & { loading: boolean; requestCount: number; onRequests: () => void };
export function ReservationsOperationSummary({ requestCount, onRequests, ...props }: Props) {
    const [detail, setDetail] = useState<{ title: string; rows: Reservation[] } | null>(null);
    const today = new Date(), sameDay = (value: string) => new Date(value).toLocaleDateString("en-CA") === today.toLocaleDateString("en-CA");
    const active = props.reservations.filter(reservation => reservation.status !== "cancelled");
    const groups = [
        { title: "Entradas hoy", rows: active.filter(reservation => sameDay(reservation.check_in_at)) },
        { title: "Salidas hoy", rows: active.filter(reservation => sameDay(reservation.check_out_at)) },
        { title: "Limpieza sin proveedor", rows: active.filter(reservation => reservation.cleaning_required && !reservation.assigned_company_id) },
    ];
    if (props.loading) return <p role="status" className="text-sm text-muted-foreground">Cargando resumen de reservas…</p>;
    return <section className="space-y-2"><div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{groups.map(group => <button key={group.title} type="button" onClick={() => setDetail(group)} className="rounded-xl border bg-card p-3 text-left focus-visible:outline-2 focus-visible:outline-accent"><span className="text-xs text-muted-foreground">{group.title}</span><strong className={`mt-1 block text-2xl font-semibold ${group.title === "Limpieza sin proveedor" && group.rows.length ? "text-orange-700 dark:text-orange-300" : ""}`}>{group.rows.length}</strong></button>)}<button type="button" onClick={onRequests} className="rounded-xl border bg-card p-3 text-left focus-visible:outline-2 focus-visible:outline-accent"><span className="text-xs text-muted-foreground">Solicitudes pendientes</span><strong className="mt-1 block text-2xl font-semibold">{requestCount}</strong></button></div><p className="text-xs text-muted-foreground">Entradas y salidas son fechas de reserva de la selección actual. La limpieza indica la empresa proveedora, no los trabajadores asignados.</p>
        <Dialog open={Boolean(detail)} onOpenChange={open => { if (!open) setDetail(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{detail?.title}</DialogTitle><DialogDescription>{detail?.rows.length ?? 0} reservas de la selección actual</DialogDescription></DialogHeader><ReservationList {...props} reservations={detail?.rows ?? []} loading={false}/></DialogContent></Dialog>
    </section>;
}
