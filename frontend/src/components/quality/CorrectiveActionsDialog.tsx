"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QualityEvidenceSection } from "@/components/quality/QualityEvidenceSection";
import { QualityIncidentStatusSection } from "@/components/quality/QualityIncidentStatusSection";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { QualityService, type QualityCorrectiveAction, type QualityEvidence, type QualityIncident } from "@/services/quality.service";

function correctiveActionStatusLabel(status: QualityCorrectiveAction["status"]): string {
    return status === "pending" ? "Pendiente" : status === "completed" ? "Completada" : "Cancelada";
}

export function CorrectiveActionsDialog({ incident, open, onOpenChange, canManage, onActionSaved, onEvidenceAdded, onIncidentUpdated }: { incident: QualityIncident | null; open: boolean; onOpenChange: (open: boolean) => void; canManage: boolean; onActionSaved: (action: QualityCorrectiveAction) => void; onEvidenceAdded: (evidence: QualityEvidence) => void; onIncidentUpdated: (incident: QualityIncident) => void }) {
    const [title, setTitle] = React.useState("");
    const [description, setDescription] = React.useState("");
    const [dueDate, setDueDate] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    const [updatingId, setUpdatingId] = React.useState<number | null>(null);
    if (!incident) return null;
    const submit = async () => {
        if (!title.trim()) return toast.error("Indica la acción que debe realizarse.");
        setSaving(true);
        try {
            const action = await QualityService.createCorrectiveAction(incident.id, { title: title.trim(), description: description.trim() || undefined, due_at: dueDate ? new Date(dueDate + "T12:00:00").toISOString() : undefined });
            onActionSaved(action); setTitle(""); setDescription(""); setDueDate(""); toast.success("Acción correctiva añadida.");
        } catch (error) { toast.error(getErrorMessage(error, "No se pudo crear la acción correctiva.")); } finally { setSaving(false); }
    };
    const setStatus = async (action: QualityCorrectiveAction, status: QualityCorrectiveAction["status"]) => {
        setUpdatingId(action.id);
        try { const updated = await QualityService.updateCorrectiveAction(incident.id, action.id, { status }); onActionSaved(updated); toast.success(status === "completed" ? "Acción correctiva completada." : "Acción correctiva cancelada."); } catch (error) { toast.error(getErrorMessage(error, "No se pudo actualizar la acción correctiva.")); } finally { setUpdatingId(null); }
    };
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent compact className="max-w-2xl" confirmDiscard>
                <DialogHeader>
                    <DialogTitle>Acciones correctivas</DialogTitle>
                    <DialogDescription>
                        {incident.title} · {incident.corrective_actions.length} acciones registradas
                    </DialogDescription>
                </DialogHeader>
                <div className="grid max-h-[60vh] gap-4 overflow-y-auto py-2">
                    <QualityIncidentStatusSection incident={incident} canManage={canManage} onUpdated={onIncidentUpdated} />
                    <QualityEvidenceSection
                        subject="incident"
                        subjectId={incident.id}
                        evidence={incident.evidence}
                        canManage={canManage}
                        onEvidenceAdded={onEvidenceAdded}
                    />
                    {canManage && (
                        <div className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-4">
                            <p className="text-sm font-semibold text-[var(--text-main)]">Nueva acción</p>
                            <div className="grid gap-2">
                                <Label htmlFor="quality-corrective-action-title">Acción</Label>
                                <Input
                                    id="quality-corrective-action-title"
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    placeholder="Ej. Reponer producto de limpieza"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="quality-corrective-action-description">Indicaciones</Label>
                                <Textarea
                                    id="quality-corrective-action-description"
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    placeholder="Responsable, alcance o comprobación necesaria"
                                    rows={2}
                                />
                            </div>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div className="grid gap-2">
                                    <Label htmlFor="quality-corrective-action-due">Fecha objetivo</Label>
                                    <DatePicker
                                        id="quality-corrective-action-due"
                                        value={dueDate}
                                        onValueChange={setDueDate}
                                    />
                                </div>
                                <Button type="button" onClick={() => void submit()} disabled={saving}>
                                    {saving && <Loader2 className="size-4 animate-spin" />}
                                    Añadir acción
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="grid gap-3">
                        {incident.corrective_actions.length === 0 ? (
                            <p className="rounded-xl border border-dashed border-[var(--border-soft)] p-4 text-sm text-[var(--text-muted)]">
                                Aún no hay acciones correctivas registradas.
                            </p>
                        ) : incident.corrective_actions.map((action) => (
                            <div
                                key={action.id}
                                className="flex flex-col gap-3 rounded-xl border border-[var(--border-soft)] p-4 sm:flex-row sm:items-start sm:justify-between"
                            >
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-semibold text-[var(--text-main)]">{action.title}</p>
                                        <Badge variant={action.status === "completed" ? "default" : action.status === "cancelled" ? "destructive" : "secondary"}>
                                            {correctiveActionStatusLabel(action.status)}
                                        </Badge>
                                    </div>
                                    {action.description && (
                                        <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text-muted)]">
                                            {action.description}
                                        </p>
                                    )}
                                    <p className="mt-2 text-xs text-[var(--text-muted)]">
                                        {action.due_at ? `Objetivo: ${formatDate(action.due_at)}` : "Sin fecha objetivo"}
                                        {action.completed_at ? ` · Completada: ${formatDate(action.completed_at)}` : ""}
                                    </p>
                                </div>
                                {canManage && action.status === "pending" && (
                                    <div className="flex shrink-0 gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => void setStatus(action, "cancelled")}
                                            disabled={updatingId === action.id}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => void setStatus(action, "completed")}
                                            disabled={updatingId === action.id}
                                        >
                                            {updatingId === action.id && <Loader2 className="size-4 animate-spin" />}
                                            Completar
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                <DialogFooter>
                    <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cerrar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
