"use client";

import * as React from "react";
import { Loader2, Plus, ShieldAlert, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QualityEvidenceSection } from "@/components/quality/QualityEvidenceSection";
import { QualityInspectionConformitySection } from "@/components/quality/QualityInspectionConformitySection";
import { QualityComplaintDialog, QualityComplaintsSection } from "@/components/quality/QualityComplaintsSection";
import { DataListTable } from "@/components/ui/data-list-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canManageQuality, canViewQuality, isPlatformSuperadmin } from "@/domain/access/roles";
import { getErrorMessage } from "@/lib/errors";
import { createEditableLineKey } from "@/lib/editable-line-key";
import { formatDate } from "@/lib/format";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { LocationService, type Location } from "@/services/location.service";
import { QualityService, type QualityComplaint, type QualityCorrectiveAction, type QualityEvidence, type QualityIncident, type QualityInspection, type QualityTemplate } from "@/services/quality.service";

type QualityTab = "templates" | "inspections" | "incidents" | "complaints";
type TemplateItemDraft = { id: string; title: string; max_points: string };

const incidentLabel: Record<QualityIncident["status"], string> = { open: "Abierta", in_progress: "En curso", resolved: "Resuelta", closed: "Cerrada" };

function correctiveActionStatusLabel(status: QualityCorrectiveAction["status"]): string {
    return status === "pending" ? "Pendiente" : status === "completed" ? "Completada" : "Cancelada";
}

function createTemplateItemDraft(): TemplateItemDraft {
    return { id: createEditableLineKey("quality-template-item"), title: "", max_points: "1" };
}
function locationName(locations: Location[], locationId: number | null) {
    if (locationId === null) return "Toda la empresa";
    return locations.find((location) => location.id === locationId)?.name ?? `Ubicación #${locationId}`;
}

function TemplateDialog({ open, onOpenChange, locations, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; locations: Location[]; onCreated: (template: QualityTemplate) => void }) {
    const [title, setTitle] = React.useState("");
    const [locationId, setLocationId] = React.useState("global");
    const [items, setItems] = React.useState<TemplateItemDraft[]>(() => [createTemplateItemDraft()]);
    const [saving, setSaving] = React.useState(false);
    const submit = async () => {
        if (!title.trim() || items.some((item) => !item.title.trim())) return toast.error("Añade un nombre y al menos un punto de inspección.");
        setSaving(true);
        try {
            const template = await QualityService.createTemplate({ title: title.trim(), location_id: locationId === "global" ? undefined : Number(locationId), items: items.map((item) => ({ title: item.title.trim(), max_points: Number(item.max_points) || 1 })) });
            onCreated(template); onOpenChange(false); setTitle(""); setLocationId("global"); setItems([createTemplateItemDraft()]); toast.success("Plantilla de inspección creada.");
        } catch (error) { toast.error(getErrorMessage(error, "No se pudo crear la plantilla.")); } finally { setSaving(false); }
    };
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent compact className="max-w-xl" confirmDiscard><DialogHeader><DialogTitle>Nueva plantilla de inspección</DialogTitle><DialogDescription>Define los puntos que deben revisarse. La plantilla queda separada de los trabajos y conserva su propio historial.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label htmlFor="quality-template-title">Nombre</Label><Input id="quality-template-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Revisión de salida" /></div><div className="grid gap-2"><Label>Ubicación</Label><Select value={locationId} onValueChange={setLocationId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="global">Toda la empresa</SelectItem>{locations.map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Puntos de inspección</Label>{items.map((item, index) => <div key={item.id} className="flex gap-2"><Input value={item.title} onChange={(event) => setItems((current) => current.map((value) => value.id === item.id ? { ...value, title: event.target.value } : value))} placeholder={`Punto ${index + 1}`} /><Input className="w-20" type="number" min="1" max="100" value={item.max_points} onChange={(event) => setItems((current) => current.map((value) => value.id === item.id ? { ...value, max_points: event.target.value } : value))} aria-label={`Puntuación máxima del punto ${index + 1}`} />{items.length > 1 && <Button type="button" variant="outline" size="sm" onClick={() => setItems((current) => current.filter((value) => value.id !== item.id))}>Quitar</Button>}</div>)}<Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setItems((current) => [...current, createTemplateItemDraft()])}><Plus className="size-4" />Añadir punto</Button></div></div><DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" onClick={() => void submit()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Guardar plantilla</Button></DialogFooter></DialogContent></Dialog>;
}

function InspectionDialog({ open, onOpenChange, templates, locations, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; templates: QualityTemplate[]; locations: Location[]; onCreated: (inspection: QualityInspection) => void }) {
    const [templateId, setTemplateId] = React.useState(""); const [locationId, setLocationId] = React.useState(""); const [saving, setSaving] = React.useState(false);
    const template = templates.find((item) => String(item.id) === templateId);
    const submit = async () => { if (!templateId || !locationId) return toast.error("Selecciona una plantilla y una ubicación."); setSaving(true); try { const inspection = await QualityService.createInspection({ template_id: Number(templateId), location_id: Number(locationId) }); onCreated(inspection); onOpenChange(false); setTemplateId(""); setLocationId(""); toast.success("Inspección iniciada."); } catch (error) { toast.error(getErrorMessage(error, "No se pudo iniciar la inspección.")); } finally { setSaving(false); } };
    const availableLocations = template?.location_id ? locations.filter((location) => location.id === template.location_id) : locations;
    const activeTemplates = React.useMemo(() => templates.filter((item) => item.is_active), [templates]);
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent compact className="max-w-lg" confirmDiscard><DialogHeader><DialogTitle>Nueva inspección</DialogTitle><DialogDescription>La inspección copia los puntos actuales de la plantilla. Cambios posteriores no alterarán este registro.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>Plantilla</Label><Select value={templateId} onValueChange={(value) => { setTemplateId(value); const next = templates.find((item) => String(item.id) === value); setLocationId(next?.location_id ? String(next.location_id) : ""); }}><SelectTrigger><SelectValue placeholder="Selecciona una plantilla" /></SelectTrigger><SelectContent>{activeTemplates.map((template) => <SelectItem key={template.id} value={String(template.id)}>{template.title}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Ubicación</Label><Select value={locationId} onValueChange={setLocationId} disabled={Boolean(template?.location_id)}><SelectTrigger><SelectValue placeholder="Selecciona una ubicación" /></SelectTrigger><SelectContent>{availableLocations.map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent></Select></div></div><DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" onClick={() => void submit()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Iniciar inspección</Button></DialogFooter></DialogContent></Dialog>;
}

function ReviewInspectionDialog({ inspection, open, onOpenChange, canManage, onCompleted, onEvidenceAdded }: { inspection: QualityInspection | null; open: boolean; onOpenChange: (open: boolean) => void; canManage: boolean; onCompleted: (inspection: QualityInspection) => void; onEvidenceAdded: (evidence: QualityEvidence) => void }) {
    const [items, setItems] = React.useState<QualityInspection["items"]>(() => inspection?.items ?? []);
    const [saving, setSaving] = React.useState(false);
    const isEditable = Boolean(inspection && canManage && inspection.status === "draft");
    const submit = async () => {
        if (!inspection || !isEditable) return;
        setSaving(true);
        try {
            const completed = await QualityService.completeInspection(inspection.id, { items: items.map((item) => ({ id: item.id, status: item.status, points_awarded: item.points_awarded, notes: item.notes ?? undefined })) });
            onCompleted(completed);
            onOpenChange(false);
            toast.success("Inspección cerrada.");
        } catch (error) {
            toast.error(getErrorMessage(error, "Completa los puntos obligatorios antes de cerrar."));
        } finally {
            setSaving(false);
        }
    };
    if (!inspection) return null;
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent compact className="max-w-2xl" confirmDiscard>
                <DialogHeader>
                    <DialogTitle>{inspection.template_title}</DialogTitle>
                    <DialogDescription>
                        {isEditable ? "Valora cada punto obligatorio antes de cerrar el control de calidad." : "Detalle y evidencia de la inspección."}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid max-h-[55vh] gap-3 overflow-y-auto py-2">
                    {items.map((item, index) => (
                        <div key={item.id} className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-3 sm:grid-cols-[1fr_150px_90px]">
                            <div>
                                <p className="text-sm font-semibold text-[var(--text-main)]">{item.title}{item.is_required ? " *" : ""}</p>
                                {item.guidance && <p className="mt-1 text-xs text-[var(--text-muted)]">{item.guidance}</p>}
                            </div>
                            <Select value={item.status} disabled={!isEditable} onValueChange={(value) => setItems((current) => current.map((valueItem, itemIndex) => itemIndex === index ? { ...valueItem, status: value as QualityInspection["items"][number]["status"], points_awarded: value === "passed" ? valueItem.max_points : 0 } : valueItem))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="not_assessed">Pendiente</SelectItem>
                                    <SelectItem value="passed">Correcto</SelectItem>
                                    <SelectItem value="failed">Fallido</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input type="number" min="0" max={item.max_points} value={item.points_awarded} disabled={!isEditable} onChange={(event) => setItems((current) => current.map((valueItem, itemIndex) => itemIndex === index ? { ...valueItem, points_awarded: Number(event.target.value) } : valueItem))} aria-label={`Puntuación ${item.title}`} />
                        </div>
                    ))}
                    <QualityEvidenceSection subject="inspection" subjectId={inspection.id} evidence={inspection.evidence} canManage={canManage} onEvidenceAdded={onEvidenceAdded} />
                    <QualityInspectionConformitySection inspection={inspection} canManage={canManage} onSigned={onCompleted} />
                </div>
                <DialogFooter>
                    <Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cerrar</Button>
                    {isEditable && <Button type="button" onClick={() => void submit()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Cerrar inspección</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function IncidentDialog({ open, onOpenChange, locations, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; locations: Location[]; onCreated: (incident: QualityIncident) => void }) {
    const [locationId, setLocationId] = React.useState(""); const [title, setTitle] = React.useState(""); const [severity, setSeverity] = React.useState<QualityIncident["severity"]>("medium"); const [saving, setSaving] = React.useState(false);
    const submit = async () => { if (!locationId || !title.trim()) return toast.error("Indica ubicación y título."); setSaving(true); try { const incident = await QualityService.createIncident({ location_id: Number(locationId), title: title.trim(), severity }); onCreated(incident); onOpenChange(false); setLocationId(""); setTitle(""); toast.success("Incidencia registrada."); } catch (error) { toast.error(getErrorMessage(error, "No se pudo registrar la incidencia.")); } finally { setSaving(false); } };
    return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent compact className="max-w-lg" confirmDiscard><DialogHeader><DialogTitle>Nueva incidencia</DialogTitle><DialogDescription>Registra una desviación de calidad. Las acciones correctivas se gestionarán dentro de la incidencia.</DialogDescription></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-2"><Label>Ubicación</Label><Select value={locationId} onValueChange={setLocationId}><SelectTrigger><SelectValue placeholder="Selecciona una ubicación" /></SelectTrigger><SelectContent>{locations.map((location) => <SelectItem key={location.id} value={String(location.id)}>{location.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label htmlFor="quality-incident-title">Título</Label><Input id="quality-incident-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Falta reposición de material" /></div><div className="grid gap-2"><Label>Severidad</Label><Select value={severity} onValueChange={(value) => setSeverity(value as QualityIncident["severity"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Baja</SelectItem><SelectItem value="medium">Media</SelectItem><SelectItem value="high">Alta</SelectItem><SelectItem value="critical">Crítica</SelectItem></SelectContent></Select></div></div><DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" onClick={() => void submit()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Registrar incidencia</Button></DialogFooter></DialogContent></Dialog>;
}


function CorrectiveActionsDialog({ incident, open, onOpenChange, canManage, onActionSaved, onEvidenceAdded }: { incident: QualityIncident | null; open: boolean; onOpenChange: (open: boolean) => void; canManage: boolean; onActionSaved: (action: QualityCorrectiveAction) => void; onEvidenceAdded: (evidence: QualityEvidence) => void }) {
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

export default function QualityPage() {
    const { user, loading: userLoading } = useUser();
    const canView = canViewQuality(user) && !isPlatformSuperadmin(user);
    const canManage = canManageQuality(user) && !isPlatformSuperadmin(user);
    const [tab, setTab] = React.useState<QualityTab>("templates");
    const [templates, setTemplates] = React.useState<QualityTemplate[]>([]);
    const [inspections, setInspections] = React.useState<QualityInspection[]>([]);
    const [incidents, setIncidents] = React.useState<QualityIncident[]>([]);
    const [complaints, setComplaints] = React.useState<QualityComplaint[]>([]);
    const [locations, setLocations] = React.useState<Location[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dialog, setDialog] = React.useState<"template" | "inspection" | "incident" | "complaint" | null>(null);
    const [selectedInspection, setSelectedInspection] = React.useState<QualityInspection | null>(null);
    const [selectedIncident, setSelectedIncident] = React.useState<QualityIncident | null>(null);
    if (!userLoading && (!user || !canView)) redirect("/dashboard");
    const load = React.useCallback(async () => { if (!canView) return; setLoading(true); try { const [nextTemplates, nextInspections, nextIncidents, nextComplaints, nextLocations] = await Promise.all([QualityService.getTemplates(), QualityService.getInspections(), QualityService.getIncidents(), QualityService.getComplaints(), LocationService.getLocations()]); setTemplates(nextTemplates); setInspections(nextInspections); setIncidents(nextIncidents); setComplaints(nextComplaints); setLocations(nextLocations); } catch (error) { toast.error(getErrorMessage(error, "No se pudo cargar el espacio de Calidad.")); } finally { setLoading(false); } }, [canView]);
    React.useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

    const saveCorrectiveAction = (action: QualityCorrectiveAction) => {
        const incidentId = selectedIncident?.id;
        if (!incidentId) return;
        const updateIncident = (incident: QualityIncident) => incident.id !== incidentId ? incident : { ...incident, corrective_actions: incident.corrective_actions.some((item) => item.id === action.id) ? incident.corrective_actions.map((item) => item.id === action.id ? action : item) : [...incident.corrective_actions, action] };
        setSelectedIncident((current) => current ? updateIncident(current) : current);
        setIncidents((current) => current.map(updateIncident));
    };
    const saveInspectionEvidence = (evidence: QualityEvidence) => {
        const inspectionId = selectedInspection?.id;
        if (!inspectionId) return;
        const updateInspection = (inspection: QualityInspection) => inspection.id === inspectionId ? { ...inspection, evidence: [...inspection.evidence, evidence] } : inspection;
        setSelectedInspection((current) => current ? updateInspection(current) : current);
        setInspections((current) => current.map(updateInspection));
    };
    const saveIncidentEvidence = (evidence: QualityEvidence) => {
        const incidentId = selectedIncident?.id;
        if (!incidentId) return;
        const updateIncident = (incident: QualityIncident) => incident.id === incidentId ? { ...incident, evidence: [...incident.evidence, evidence] } : incident;
        setSelectedIncident((current) => current ? updateIncident(current) : current);
        setIncidents((current) => current.map(updateIncident));
    };
    const saveComplaint = (complaint: QualityComplaint) => setComplaints((current) => current.some((item) => item.id === complaint.id) ? current.map((item) => item.id === complaint.id ? complaint : item) : [complaint, ...current]);
    if (userLoading || loading) return <div className="flex min-h-[400px] flex-col items-center justify-center gap-3"><Loader2 className="size-8 animate-spin text-accent" /><span className="text-xs text-[var(--text-muted)]">Cargando control de calidad…</span></div>;
    const action = canManage ? <Button type="button" className={PAGE_ACTION_BUTTON_PRIMARY} onClick={() => setDialog(tab === "templates" ? "template" : tab === "inspections" ? "inspection" : tab === "incidents" ? "incident" : "complaint")}><Plus className="size-4" />{tab === "templates" ? "Nueva plantilla" : tab === "inspections" ? "Nueva inspección" : tab === "incidents" ? "Nueva incidencia" : "Nueva reclamación"}</Button> : undefined;
    return <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8"><PageHeader icon={Sparkles} title="Calidad" subtitle="Inspecciones, incidencias y reclamaciones con trazabilidad por ubicación." actions={action} /><PremiumTabs tabs={[{ id: "templates", label: "Plantillas" }, { id: "inspections", label: "Inspecciones" }, { id: "incidents", label: "Incidencias" }, { id: "complaints", label: "Reclamaciones" }]} activeTab={tab} onChange={setTab} />{tab === "templates" && <DataListTable items={templates} getRowKey={(item) => item.id} header={{ title: "Plantillas de inspección", subtitle: "Puntos reutilizables y puntuables por ubicación.", countLabel: `${templates.length} plantillas` }} columns={[{ key: "name", label: "Plantilla", className: "w-[50%]" }, { key: "location", label: "Ubicación", className: "w-[30%]" }, { key: "items", label: "Puntos", className: "w-[20%] text-right" }]} renderDesktopRow={(item) => [<span key="name" className="font-semibold text-[var(--text-main)]">{item.title}</span>, <span key="location" className="text-[var(--text-muted)]">{locationName(locations, item.location_id)}</span>, <span key="items" className="block text-right tabular-nums text-[var(--text-main)]">{item.items.length}</span>]} renderCompactRow={(item) => <div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-[var(--text-main)]">{item.title}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{locationName(locations, item.location_id)} · {item.items.length} puntos</p></div><Badge variant={item.is_active ? "default" : "secondary"}>{item.is_active ? "Activa" : "Inactiva"}</Badge></div>} empty={<p className="text-sm text-[var(--text-muted)]">Crea la primera plantilla para empezar a inspeccionar.</p>} />}{tab === "inspections" && <DataListTable items={inspections} getRowKey={(item) => item.id} onRowClick={setSelectedInspection} rowAriaLabel={() => "Abrir inspección y evidencias"} header={{ title: "Inspecciones", subtitle: "Cada control conserva la plantilla que se utilizó en ese momento.", countLabel: `${inspections.length} inspecciones` }} columns={[{ key: "template", label: "Inspección", className: "w-[40%]" }, { key: "location", label: "Ubicación", className: "w-[27%]" }, { key: "score", label: "Puntuación", className: "w-[18%] text-right" }, { key: "status", label: "Estado", className: "w-[15%] text-right" }]} renderDesktopRow={(item) => [<span key="template" className="font-semibold text-[var(--text-main)]">{item.template_title}</span>, <span key="location" className="text-[var(--text-muted)]">{locationName(locations, item.location_id)}</span>, <span key="score" className="block text-right tabular-nums text-[var(--text-main)]">{item.score}/{item.max_score} · {item.evidence.length} fotos</span>, <span key="status" className="block text-right"><Badge variant={item.status === "completed" ? "default" : "secondary"}>{item.status === "completed" ? "Cerrada" : "Borrador"}</Badge></span>]} renderCompactRow={(item) => <div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-[var(--text-main)]">{item.template_title}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{locationName(locations, item.location_id)} · {item.score}/{item.max_score} · {item.evidence.length} fotos</p></div><Badge variant={item.status === "completed" ? "default" : "secondary"}>{item.status === "completed" ? "Cerrada" : "Borrador"}</Badge></div>} empty={<p className="text-sm text-[var(--text-muted)]">Aún no hay inspecciones iniciadas.</p>} />}{tab === "incidents" && <DataListTable items={incidents} getRowKey={(item) => item.id} onRowClick={setSelectedIncident} rowAriaLabel={() => "Abrir acciones correctivas y evidencias"} header={{ title: "Incidencias y acciones correctivas", subtitle: "Desviaciones de calidad separadas de los partes de trabajo.", countLabel: `${incidents.length} incidencias` }} columns={[{ key: "incident", label: "Incidencia", className: "w-[38%]" }, { key: "location", label: "Ubicación", className: "w-[27%]" }, { key: "actions", label: "Acciones", className: "w-[17%] text-right" }, { key: "status", label: "Estado", className: "w-[18%] text-right" }]} renderDesktopRow={(item) => [<span key="incident" className="font-semibold text-[var(--text-main)]">{item.title}</span>, <span key="location" className="text-[var(--text-muted)]">{locationName(locations, item.location_id)}</span>, <span key="actions" className="block text-right tabular-nums text-[var(--text-main)]">{item.corrective_actions.length} acciones · {item.evidence.length} fotos</span>, <span key="status" className="block text-right"><Badge variant={item.status === "resolved" || item.status === "closed" ? "default" : "secondary"}>{incidentLabel[item.status]}</Badge></span>]} renderCompactRow={(item) => <div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-[var(--text-main)]">{item.title}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{locationName(locations, item.location_id)} · {item.corrective_actions.length} acciones · {item.evidence.length} fotos · {formatDate(item.created_at)}</p></div><ShieldAlert className="size-4 shrink-0 text-accent" /></div>} empty={<p className="text-sm text-[var(--text-muted)]">No hay incidencias abiertas.</p>} />}{tab === "complaints" && <QualityComplaintsSection complaints={complaints} locations={locations} canManage={canManage} onUpdated={saveComplaint} />}{canManage && <><TemplateDialog open={dialog === "template"} onOpenChange={(open) => setDialog(open ? "template" : null)} locations={locations} onCreated={(template) => setTemplates((current) => [template, ...current])} /><InspectionDialog open={dialog === "inspection"} onOpenChange={(open) => setDialog(open ? "inspection" : null)} templates={templates} locations={locations} onCreated={(inspection) => setInspections((current) => [inspection, ...current])} /><IncidentDialog open={dialog === "incident"} onOpenChange={(open) => setDialog(open ? "incident" : null)} locations={locations} onCreated={(incident) => setIncidents((current) => [incident, ...current])} /><QualityComplaintDialog open={dialog === "complaint"} onOpenChange={(open) => setDialog(open ? "complaint" : null)} locations={locations} onCreated={saveComplaint} /></>}<ReviewInspectionDialog key={`inspection-${selectedInspection?.id ?? "none"}`} inspection={selectedInspection} open={Boolean(selectedInspection)} onOpenChange={(open) => !open && setSelectedInspection(null)} canManage={canManage} onCompleted={(inspection) => setInspections((current) => current.map((item) => item.id === inspection.id ? inspection : item))} onEvidenceAdded={saveInspectionEvidence} /><CorrectiveActionsDialog key={`incident-${selectedIncident?.id ?? "none"}`} incident={selectedIncident} open={Boolean(selectedIncident)} onOpenChange={(open) => !open && setSelectedIncident(null)} canManage={canManage} onActionSaved={saveCorrectiveAction} onEvidenceAdded={saveIncidentEvidence} /></div>;
}
