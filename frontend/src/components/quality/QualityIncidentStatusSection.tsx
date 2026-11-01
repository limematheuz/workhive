"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getErrorMessage } from "@/lib/errors";
import { incidentStatusLabel } from "@/lib/quality-incident-status";
import { toast } from "@/lib/toast";
import { QualityService, type QualityIncident } from "@/services/quality.service";

export function QualityIncidentStatusSection({ incident, canManage, onUpdated }: {
    incident: QualityIncident;
    canManage: boolean;
    onUpdated: (incident: QualityIncident) => void;
}) {
    const [saving, setSaving] = useState(false);
    const changeStatus = async (status: QualityIncident["status"]) => {
        if (!canManage || saving || status === incident.status) return;
        setSaving(true);
        try {
            const updated = await QualityService.updateIncidentStatus(incident.id, status);
            onUpdated(updated);
            toast.success("Estado de incidencia actualizado.");
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo actualizar el estado de la incidencia."));
        } finally {
            setSaving(false);
        }
    };
    const id = `quality-incident-status-${incident.id}`;
    return <section data-form-guard-ignore className="grid gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-4">
        <Label htmlFor={canManage ? id : undefined}>Estado de la incidencia</Label>
        {canManage ? <Select value={incident.status} disabled={saving} onValueChange={(value) => void changeStatus(value as QualityIncident["status"])}>
            <SelectTrigger id={id} aria-label="Estado de la incidencia"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(incidentStatusLabel).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
        </Select> : <Badge variant="secondary">{incidentStatusLabel[incident.status]}</Badge>}
        <p className="text-xs text-[var(--text-muted)]" role="status">{saving ? "Guardando estado…" : "El estado de la incidencia se guarda por separado de sus acciones correctivas."}</p>
    </section>;
}
