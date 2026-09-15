"use client";

import { useState } from "react";
import { CircleAlert, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ClientPortalService } from "@/services/client-portal.service";
import type { ClientPortalComplaint, ClientPortalComplaintLocation } from "@/types/client-portal";

type ClientPortalComplaintsProps = {
    complaints: ClientPortalComplaint[];
    locations: ClientPortalComplaintLocation[];
    workspaceId: number;
    onCreated: (complaint: ClientPortalComplaint) => void;
};

const date = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });

const categoryLabel: Record<ClientPortalComplaint["category"], string> = {
    service: "Servicio",
    billing: "Facturación",
    damage: "Daños",
    other: "Otro",
};

const statusLabel: Record<ClientPortalComplaint["status"], string> = {
    submitted: "Recibida",
    in_review: "En revisión",
    resolved: "Resuelta",
    closed: "Cerrada",
};

function formatDate(value: string): string {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : date.format(parsed);
}

export function ClientPortalComplaints({ complaints, locations, workspaceId, onCreated }: ClientPortalComplaintsProps) {
    const [locationId, setLocationId] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState<ClientPortalComplaint["category"]>("service");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (!locationId || !title.trim() || !description.trim() || saving) return;
        setSaving(true);
        try {
            const complaint = await ClientPortalService.createComplaint(workspaceId, {
                location_id: Number(locationId),
                title: title.trim(),
                description: description.trim(),
                category,
            });
            onCreated(complaint);
            setLocationId("");
            setTitle("");
            setDescription("");
            setCategory("service");
            toast.success("Reclamación enviada. Te avisaremos desde este portal cuando haya respuesta.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo presentar la reclamación.");
        } finally {
            setSaving(false);
        }
    };

    return <div className="space-y-5">
        <Card><CardContent className="space-y-4"><div><h2 className="font-semibold text-[var(--text-main)]">Nueva reclamación</h2><p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">Cuéntanos qué ha ocurrido. Solo el equipo responsable de esta ubicación podrá tramitarla.</p></div>{locations.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--border-soft)] p-4 text-sm text-[var(--text-muted)]">No hay ubicaciones activas disponibles para presentar una reclamación.</p> : <><div className="grid gap-4 sm:grid-cols-2"><div className="grid gap-2"><Label>Ubicación</Label><Select value={locationId} onValueChange={setLocationId}><SelectTrigger><SelectValue placeholder="Selecciona una ubicación" /></SelectTrigger><SelectContent>{locations.map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Motivo</Label><Select value={category} onValueChange={(value) => setCategory(value as ClientPortalComplaint["category"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categoryLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-2"><Label htmlFor="portal-complaint-title">Asunto</Label><Input id="portal-complaint-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} placeholder="Resume el motivo de la reclamación" /></div><div className="grid gap-2"><Label htmlFor="portal-complaint-description">Detalle</Label><Textarea id="portal-complaint-description" value={description} maxLength={5_000} onChange={(event) => setDescription(event.target.value)} rows={4} placeholder="Indica qué ha ocurrido y cualquier dato que ayude a revisarlo." /></div><Button type="button" onClick={() => void submit()} disabled={saving || !locationId || !title.trim() || !description.trim()}>{saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {saving ? "Enviando…" : "Presentar reclamación"}</Button></>}</CardContent></Card>
        {complaints.length === 0 ? <Card><CardContent className="py-12 text-center"><CircleAlert className="mx-auto size-8 text-accent" aria-hidden="true" /><p className="mt-3 font-semibold text-[var(--text-main)]">No hay reclamaciones registradas</p><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[var(--text-muted)]">Las reclamaciones que presentes para tus ubicaciones aparecerán aquí con su estado y respuesta.</p></CardContent></Card> : <section className="space-y-3">{complaints.map((complaint) => <Card key={complaint.id}><CardContent><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant={complaint.status === "resolved" || complaint.status === "closed" ? "default" : "secondary"}>{statusLabel[complaint.status]}</Badge><span className="text-xs text-[var(--text-muted)]">{categoryLabel[complaint.category]} · {complaint.location_name}</span></div><h2 className="mt-2 font-semibold text-[var(--text-main)]">{complaint.title}</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text-muted)]">{complaint.description}</p></div><p className="shrink-0 text-xs text-[var(--text-muted)]">{formatDate(complaint.created_at)}</p></div>{complaint.customer_response && <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-3"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Respuesta del equipo</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[var(--text-main)]">{complaint.customer_response}</p></div>}</CardContent></Card>)}</section>}
    </div>;
}
