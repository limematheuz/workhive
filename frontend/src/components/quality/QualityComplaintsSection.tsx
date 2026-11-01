"use client";

import { useState } from "react";
import { Loader2, MessageSquareWarning } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { type Location } from "@/services/location.service";
import { QualityService, type QualityComplaint } from "@/services/quality.service";

type QualityComplaintsSectionProps = {
    complaints: QualityComplaint[];
    locations: Location[];
    canManage: boolean;
    onUpdated: (complaint: QualityComplaint) => void;
};

type QualityComplaintDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    locations: Location[];
    onCreated: (complaint: QualityComplaint) => void;
};

const categoryLabel: Record<QualityComplaint["category"], string> = {
    service: "Servicio",
    billing: "Facturación",
    damage: "Daños",
    other: "Otro",
};

const statusLabel: Record<QualityComplaint["status"], string> = {
    submitted: "Recibida",
    in_review: "En revisión",
    resolved: "Resuelta",
    closed: "Cerrada",
};

function locationName(locations: Location[], locationId: number): string {
    return locations.find((location) => location.id === locationId)?.name ?? `Ubicación #${locationId}`;
}

export function QualityComplaintDialog({ open, onOpenChange, locations, onCreated }: QualityComplaintDialogProps) {
    const [locationId, setLocationId] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState<QualityComplaint["category"]>("service");
    const [saving, setSaving] = useState(false);
    const customerLocations = locations.filter((location) => location.client_id != null);

    const submit = async () => {
        if (!locationId || !title.trim() || !description.trim() || saving) return;
        setSaving(true);
        try {
            const complaint = await QualityService.createComplaint({
                location_id: Number(locationId),
                title: title.trim(),
                description: description.trim(),
                category,
            });
            onCreated(complaint);
            onOpenChange(false);
            setLocationId("");
            setTitle("");
            setDescription("");
            setCategory("service");
            toast.success("Reclamación registrada.");
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo registrar la reclamación."));
        } finally {
            setSaving(false);
        }
    };

    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent compact className="max-w-lg" confirmDiscard><DialogHeader><DialogTitle>Nueva reclamación</DialogTitle><DialogDescription>Registra la comunicación del cliente. La ubicación debe pertenecer a un cliente activo.</DialogDescription></DialogHeader><div className="grid gap-4 py-2">{customerLocations.length === 0 ? <p className="rounded-xl border border-dashed border-[var(--border-soft)] p-3 text-sm text-[var(--text-muted)]">No hay ubicaciones de cliente disponibles.</p> : <><div className="grid gap-2"><Label>Ubicación</Label><Select value={locationId} onValueChange={setLocationId}><SelectTrigger><SelectValue placeholder="Selecciona una ubicación" /></SelectTrigger><SelectContent>{customerLocations.map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Motivo</Label><Select value={category} onValueChange={(value) => setCategory(value as QualityComplaint["category"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(categoryLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="quality-complaint-title">Asunto</Label><Input id="quality-complaint-title" value={title} maxLength={200} onChange={(event) => setTitle(event.target.value)} /></div><div className="grid gap-2"><Label htmlFor="quality-complaint-description">Detalle</Label><Textarea id="quality-complaint-description" value={description} maxLength={5_000} rows={4} onChange={(event) => setDescription(event.target.value)} /></div></>}</div><DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" onClick={() => void submit()} disabled={saving || !locationId || !title.trim() || !description.trim()}>{saving && <Loader2 className="size-4 animate-spin" />}Registrar reclamación</Button></DialogFooter></DialogContent></Dialog>;
}

function ComplaintDetailDialog({ complaint, open, onOpenChange, canManage, onUpdated }: { complaint: QualityComplaint | null; open: boolean; onOpenChange: (open: boolean) => void; canManage: boolean; onUpdated: (complaint: QualityComplaint) => void }) {
    const [status, setStatus] = useState<QualityComplaint["status"]>(complaint?.status ?? "submitted");
    const [internalNotes, setInternalNotes] = useState(complaint?.internal_notes ?? "");
    const [customerResponse, setCustomerResponse] = useState(complaint?.customer_response ?? "");
    const [saving, setSaving] = useState(false);

    if (!complaint) return null;
    const submit = async () => {
        if (!canManage || saving) return;
        setSaving(true);
        try {
            const updated = await QualityService.updateComplaint(complaint.id, {
                status,
                internal_notes: internalNotes.trim() || null,
                customer_response: customerResponse.trim() || null,
            });
            onUpdated(updated);
            onOpenChange(false);
            toast.success("Reclamación actualizada.");
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo actualizar la reclamación."));
        } finally {
            setSaving(false);
        }
    };
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent compact className="max-w-2xl" confirmDiscard><DialogHeader><DialogTitle>{complaint.title}</DialogTitle><DialogDescription>{categoryLabel[complaint.category]} · Registrada el {formatDate(complaint.created_at)} · {complaint.source === "client_portal" ? "Presentada desde el portal" : "Registrada internamente"}</DialogDescription></DialogHeader><div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2"><div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-4"><p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-main)]">{complaint.description}</p></div><div className="grid gap-2"><Label>Estado</Label><Select value={status} onValueChange={(value) => setStatus(value as QualityComplaint["status"])} disabled={!canManage}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor={`complaint-response-${complaint.id}`}>Respuesta visible al cliente</Label><Textarea id={`complaint-response-${complaint.id}`} value={customerResponse} maxLength={5_000} rows={4} disabled={!canManage} onChange={(event) => setCustomerResponse(event.target.value)} placeholder="Explica la revisión, solución o siguiente paso." /></div><div className="grid gap-2"><Label htmlFor={`complaint-internal-notes-${complaint.id}`}>Notas internas</Label><Textarea id={`complaint-internal-notes-${complaint.id}`} value={internalNotes} maxLength={5_000} rows={4} disabled={!canManage} onChange={(event) => setInternalNotes(event.target.value)} placeholder="Estas notas nunca se muestran en el portal de cliente." /></div></div><DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cerrar</Button>{canManage && <Button type="button" onClick={() => void submit()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Guardar tramitación</Button>}</DialogFooter></DialogContent></Dialog>;
}

export function QualityComplaintsSection({ complaints, locations, canManage, onUpdated }: QualityComplaintsSectionProps) {
    const [selected, setSelected] = useState<QualityComplaint | null>(null);
    const save = (complaint: QualityComplaint) => {
        onUpdated(complaint);
        setSelected(complaint);
    };
    return <><DataListTable desktopFrom="lg" items={complaints} getRowKey={(item) => item.id} onRowClick={setSelected} rowAriaLabel={() => "Abrir reclamación"} header={{ title: "Reclamaciones", subtitle: "Expedientes del cliente separados de las incidencias operativas.", countLabel: `${complaints.length} ${complaints.length === 1 ? "reclamación" : "reclamaciones"}` }} columns={[{ key: "complaint", label: "Reclamación", className: "w-[38%]" }, { key: "location", label: "Ubicación", className: "w-[24%]" }, { key: "source", label: "Origen", className: "w-[18%]" }, { key: "status", label: "Estado", className: "w-[20%] text-right" }]} renderDesktopRow={(item) => [<span key="complaint" className="font-semibold text-[var(--text-main)]">{item.title}<span className="ml-2 text-xs font-normal text-[var(--text-muted)]">{categoryLabel[item.category]}</span></span>, <span key="location" className="text-[var(--text-muted)]">{locationName(locations, item.location_id)}</span>, <span key="source" className="text-[var(--text-muted)]">{item.source === "client_portal" ? "Portal cliente" : "Interna"}</span>, <span key="status" className="block text-right"><Badge variant={item.status === "resolved" || item.status === "closed" ? "default" : "secondary"}>{statusLabel[item.status]}</Badge></span>]} renderCompactRow={(item) => <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{item.title}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{locationName(locations, item.location_id)} · {item.source === "client_portal" ? "Portal cliente" : "Interna"} · {formatDate(item.created_at)}</p></div><Badge variant={item.status === "resolved" || item.status === "closed" ? "default" : "secondary"}>{statusLabel[item.status]}</Badge></div>} empty={<div className="py-5 text-center"><MessageSquareWarning className="mx-auto size-6 text-accent" /><p className="mt-3 text-sm text-[var(--text-muted)]">Aún no hay reclamaciones registradas.</p></div>} /><ComplaintDetailDialog key={selected?.id ?? "none"} complaint={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} canManage={canManage} onUpdated={save} /></>;
}
