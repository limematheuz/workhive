"use client";

import { useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PartnerPortalService } from "@/services/partner-portal.service";
import type { Location } from "@/types/location";
import type { Reservation } from "@/types/reservation";
import type { PartnerPortalReservationInput } from "@/types/partner-portal";
import { toDateTimeLocal } from "@/lib/partner-portal-form";

export function RequestDialog({
    reservation,
    locations,
    open,
    onOpenChange,
    onSaved,
}: {
    reservation?: Reservation | null;
    locations: Location[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSaved: (reservation: Reservation, isNew: boolean) => void;
}) {
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState(() => reservation ? {
        locationId: String(reservation.location_id),
        checkIn: toDateTimeLocal(reservation.check_in_at),
        checkOut: toDateTimeLocal(reservation.check_out_at),
        guests: String(reservation.guest_count),
        reference: reservation.external_reference ?? "",
        notes: reservation.notes ?? "",
    } : { locationId: "", checkIn: "", checkOut: "", guests: "1", reference: "", notes: "" });

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!form.locationId || !form.checkIn || !form.checkOut) {
            toast.error("Indica la propiedad y las fechas de la estancia.");
            return;
        }
        if (new Date(form.checkOut) <= new Date(form.checkIn)) {
            toast.error("La salida debe ser posterior a la entrada.");
            return;
        }
        setSubmitting(true);
        try {
            const data: PartnerPortalReservationInput = {
                location_id: Number(form.locationId),
                check_in_at: new Date(form.checkIn).toISOString(),
                check_out_at: new Date(form.checkOut).toISOString(),
                guest_count: Number(form.guests) || 1,
                stay_type: reservation?.stay_type ?? "guest",
                status: reservation?.status ?? "confirmed",
                source: reservation?.source ?? "partner_portal",
                external_reference: form.reference.trim() || null,
                notes: form.notes.trim() || null,
            };
            const saved = reservation
                ? await PartnerPortalService.updateReservation(reservation.id, data)
                : await PartnerPortalService.createReservation(data);
            onSaved(saved, !reservation);
            onOpenChange(false);
            toast.success(reservation ? "Solicitud actualizada." : "Solicitud enviada a la empresa de limpieza.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo enviar la solicitud.");
        } finally {
            setSubmitting(false);
        }
    };

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent compact className="max-w-xl">
            <DialogHeader><DialogTitle>{reservation ? "Editar solicitud de limpieza" : "Nueva solicitud de limpieza"}</DialogTitle><DialogDescription>Al guardar, se enviará una solicitud a tu empresa de limpieza asignada.</DialogDescription></DialogHeader>
            <form className="grid gap-4" onSubmit={submit}>
                <div className="grid gap-2"><Label htmlFor="partner-location">Propiedad</Label><Select disabled={Boolean(reservation)} value={form.locationId} onValueChange={(locationId) => setForm(current => ({ ...current, locationId }))}><SelectTrigger id="partner-location"><SelectValue placeholder="Selecciona una propiedad" /></SelectTrigger><SelectContent>{locations.map(location => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="partner-check-in">Entrada</Label><Input id="partner-check-in" type="datetime-local" value={form.checkIn} onChange={event => setForm(current => ({ ...current, checkIn: event.target.value }))} /></div><div className="grid gap-2"><Label htmlFor="partner-check-out">Salida</Label><Input id="partner-check-out" type="datetime-local" value={form.checkOut} onChange={event => setForm(current => ({ ...current, checkOut: event.target.value }))} /></div></div>
                <div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label htmlFor="partner-guests">Huéspedes</Label><Input id="partner-guests" type="number" min="1" value={form.guests} onChange={event => setForm(current => ({ ...current, guests: event.target.value }))} /></div><div className="grid gap-2"><Label htmlFor="partner-reference">Referencia</Label><Input id="partner-reference" value={form.reference} onChange={event => setForm(current => ({ ...current, reference: event.target.value }))} placeholder="Opcional" /></div></div>
                <div className="grid gap-2"><Label htmlFor="partner-notes">Notas para la limpieza</Label><Textarea id="partner-notes" value={form.notes} onChange={event => setForm(current => ({ ...current, notes: event.target.value }))} placeholder="Opcional" /></div>
                <DialogFooter className="mt-2"><DialogClose asChild><Button type="button" variant="cancel">Cancelar</Button></DialogClose><Button type="submit" disabled={submitting}>{submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}{reservation ? "Guardar cambios" : "Enviar solicitud"}</Button></DialogFooter>
            </form>
        </DialogContent>
    </Dialog>;
}
