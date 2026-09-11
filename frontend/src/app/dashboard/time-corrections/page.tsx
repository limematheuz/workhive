"use client";

import * as React from "react";
import { ClipboardCheck, Clock3, FilePenLine, Loader2, MapPin, UserRound } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Textarea } from "@/components/ui/textarea";
import { canApproveTime, canManageTime } from "@/domain/access/roles";
import { getErrorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { WorkSessionCorrectionService } from "@/services/work-session-correction.service";
import { WorkSessionService } from "@/services/work-session.service";
import type { WorkSession } from "@/types/user";
import type { WorkSessionCorrection, WorkSessionCorrectionStatus } from "@/types/work-session-correction";

type ActiveTab = "sessions" | "review";

const statusLabel: Record<WorkSessionCorrectionStatus, string> = {
    pending: "Pendiente",
    approved: "Aprobada",
    rejected: "Rechazada",
};

const dateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
});

function DateTimeText({ value }: { value: string }) {
    const [formattedValue, setFormattedValue] = React.useState<string | null>(null);

    React.useEffect(() => {
        setFormattedValue(dateTimeFormatter.format(new Date(value)));
    }, [value]);

    return <>{formattedValue ?? "…"}</>;
}

function CorrectionStatus({ status }: { status: WorkSessionCorrectionStatus }) {
    return <Badge variant={status === "approved" ? "default" : "secondary"}>{statusLabel[status]}</Badge>;
}

function RequestCorrectionDialog({
    session,
    open,
    onOpenChange,
    onRequested,
}: {
    session: WorkSession | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRequested: (correction: WorkSessionCorrection) => void;
}) {
    const [requestedStart, setRequestedStart] = React.useState<string | null>(() => session?.start_time ?? null);
    const [requestedEnd, setRequestedEnd] = React.useState<string | null>(() => session?.end_time ?? null);
    const [reason, setReason] = React.useState("");
    const [saving, setSaving] = React.useState(false);

    const submit = async () => {
        if (!session || !requestedStart || !requestedEnd || reason.trim().length < 5) {
            toast.error("Indica el horario correcto y el motivo de la corrección.");
            return;
        }
        if (new Date(requestedEnd) <= new Date(requestedStart)) {
            toast.error("La salida propuesta debe ser posterior a la entrada.");
            return;
        }
        setSaving(true);
        try {
            const correction = await WorkSessionCorrectionService.requestCorrection(session.id, {
                requested_start_time: requestedStart,
                requested_end_time: requestedEnd,
                reason: reason.trim(),
            });
            onRequested(correction);
            toast.success("Corrección enviada para revisión.");
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo enviar la corrección."));
        } finally {
            setSaving(false);
        }
    };

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent compact className="max-w-xl" confirmDiscard>
            <DialogHeader>
                <DialogTitle>Solicitar corrección</DialogTitle>
                <DialogDescription>Propón el horario correcto. Una persona autorizada deberá aprobarlo antes de que cambie el fichaje.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-2">
                <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 py-2.5 text-sm text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text-main)]">Registro actual: </span>
                    {session && <><DateTimeText value={session.start_time} /> — <DateTimeText value={session.end_time ?? session.start_time} /></>}
                </div>
                <div className="grid gap-2"><Label htmlFor="correction-start">Entrada correcta</Label><DateTimePicker id="correction-start" value={requestedStart} onValueChange={setRequestedStart} /></div>
                <div className="grid gap-2"><Label htmlFor="correction-end">Salida correcta</Label><DateTimePicker id="correction-end" value={requestedEnd} onValueChange={setRequestedEnd} /></div>
                <div className="grid gap-2"><Label htmlFor="correction-reason">Motivo</Label><Textarea id="correction-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} placeholder="Explica qué ocurrió para que la persona responsable pueda revisarlo." /></div>
            </div>
            <DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" onClick={() => void submit()} disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Enviar solicitud</Button></DialogFooter>
        </DialogContent>
    </Dialog>;
}

function ReviewCorrectionDialog({
    correction,
    open,
    onOpenChange,
    onReviewed,
}: {
    correction: WorkSessionCorrection | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onReviewed: (correction: WorkSessionCorrection) => void;
}) {
    const [note, setNote] = React.useState("");
    const [saving, setSaving] = React.useState<"approved" | "rejected" | null>(null);

    const review = async (decision: "approved" | "rejected") => {
        if (!correction) return;
        setSaving(decision);
        try {
            const reviewed = await WorkSessionCorrectionService.reviewCorrection(correction.id, {
                decision,
                note: note.trim() || undefined,
            });
            onReviewed(reviewed);
            toast.success(decision === "approved" ? "Corrección aprobada." : "Corrección rechazada.");
            onOpenChange(false);
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudo revisar la corrección."));
        } finally {
            setSaving(null);
        }
    };

    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent compact className="max-w-xl" confirmDiscard>
            <DialogHeader>
                <DialogTitle>Revisar corrección</DialogTitle>
                <DialogDescription>Al aprobar, se actualizará el fichaje y quedará guardado el horario original, la petición y tu decisión.</DialogDescription>
            </DialogHeader>
            {correction && <div className="grid gap-4 py-2">
                <div className="grid gap-2 rounded-xl border border-[var(--border-soft)] p-3 text-sm">
                    <p className="font-semibold text-[var(--text-main)]">{correction.requester_name || "Persona de la empresa"} · {correction.location_name || "Ubicación"}</p>
                    <p className="text-[var(--text-muted)]">Actual: <DateTimeText value={correction.original_start_time} /> — <DateTimeText value={correction.original_end_time} /></p>
                    <p className="font-medium text-[var(--text-main)]">Solicitado: <DateTimeText value={correction.requested_start_time} /> — <DateTimeText value={correction.requested_end_time} /></p>
                    <p className="text-[var(--text-muted)]">Motivo: {correction.reason}</p>
                </div>
                <div className="grid gap-2"><Label htmlFor="correction-review-note">Nota para la persona (opcional)</Label><Textarea id="correction-review-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Explica la decisión si aporta contexto." /></div>
            </div>}
            <DialogFooter><Button type="button" variant="cancel" onClick={() => onOpenChange(false)}>Cancelar</Button><Button type="button" variant="secondary" onClick={() => void review("rejected")} disabled={saving !== null}>{saving === "rejected" && <Loader2 className="size-4 animate-spin" />}Rechazar</Button><Button type="button" onClick={() => void review("approved")} disabled={saving !== null}>{saving === "approved" && <Loader2 className="size-4 animate-spin" />}Aprobar</Button></DialogFooter>
        </DialogContent>
    </Dialog>;
}

export default function TimeCorrectionsPage() {
    const { user, loading: userLoading } = useUser();
    const [tab, setTab] = React.useState<ActiveTab>("sessions");
    const [sessions, setSessions] = React.useState<WorkSession[]>([]);
    const [corrections, setCorrections] = React.useState<WorkSessionCorrection[]>([]);
    const [reviewQueue, setReviewQueue] = React.useState<WorkSessionCorrection[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [requestingSession, setRequestingSession] = React.useState<WorkSession | null>(null);
    const [reviewingCorrection, setReviewingCorrection] = React.useState<WorkSessionCorrection | null>(null);
    const canManage = canManageTime(user);
    const canReview = canApproveTime(user);

    const load = React.useCallback(async () => {
        if (!canManage) return;
        setLoading(true);
        try {
            const [nextSessions, ownCorrections, nextReviewQueue] = await Promise.all([
                WorkSessionService.getWorkSessions(),
                WorkSessionCorrectionService.getOwn(),
                canReview ? WorkSessionCorrectionService.getReviewQueue() : Promise.resolve([]),
            ]);
            setSessions(nextSessions.filter((session) => session.end_time !== null));
            setCorrections(ownCorrections);
            setReviewQueue(nextReviewQueue);
        } catch (error) {
            toast.error(getErrorMessage(error, "No se pudieron cargar los fichajes."));
        } finally {
            setLoading(false);
        }
    }, [canManage, canReview]);

    React.useEffect(() => {
        if (userLoading) return;
        if (!canManage) return;
        const timer = window.setTimeout(() => void load(), 0);
        return () => window.clearTimeout(timer);
    }, [canManage, load, userLoading]);

    const correctionBySession = React.useMemo(() => new Map(
        corrections.map((correction) => [correction.work_session_id, correction]),
    ), [corrections]);

    const replaceCorrection = (reviewed: WorkSessionCorrection) => {
        setReviewQueue((current) => current.map((item) => item.id === reviewed.id ? reviewed : item));
        setCorrections((current) => current.map((item) => item.id === reviewed.id ? reviewed : item));
        setSessions((current) => current.map((session) => session.id === reviewed.work_session_id ? {
            ...session,
            start_time: reviewed.status === "approved" ? reviewed.requested_start_time : session.start_time,
            end_time: reviewed.status === "approved" ? reviewed.requested_end_time : session.end_time,
        } : session));
    };

    if (userLoading) {
        return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-accent" /></div>;
    }

    if (!canManage) {
        return <div className="dashboard-page-content px-[3%] py-6 md:p-8"><div className="billing-block rounded-2xl px-5 py-12 text-center"><Clock3 className="mx-auto size-8 text-[var(--text-muted)]" /><h2 className="mt-3 text-lg font-bold text-[var(--text-main)]">No tienes acceso a fichajes</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Pide a un administrador que te asigne un perfil con control horario.</p></div></div>;
    }

    if (loading) {
        return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="size-8 animate-spin text-accent" /></div>;
    }

    return <div className="dashboard-page-content px-[3%] py-6 md:p-8">
        <PageHeader icon={ClipboardCheck} title="Fichajes" subtitle="Consulta jornadas cerradas, solicita una corrección y revisa las peticiones que entren en tu ámbito." className="mb-6" />
        <PremiumTabs
            layout="fit"
            className="mb-5"
            tabs={[
                { id: "sessions", label: "Mis jornadas", icon: Clock3, badge: sessions.length },
                ...(canReview ? [{ id: "review", label: "Para revisar", icon: UserRound, badge: reviewQueue.filter((item) => item.status === "pending").length }] : []),
            ]}
            activeTab={tab}
            onChange={(next) => setTab(next as ActiveTab)}
        />
        {tab === "sessions" ? <DataListTable
            items={sessions}
            getRowKey={(session) => session.id}
            desktopFrom="lg"
            header={{ title: "Jornadas cerradas", subtitle: "Las correcciones aprobadas actualizan el registro y conservan siempre el horario original.", countLabel: `${sessions.length} jornadas` }}
            columns={[{ key: "date", label: "Fecha", className: "w-[16%]" }, { key: "location", label: "Ubicación", className: "w-[25%]" }, { key: "start", label: "Entrada", className: "w-[16%]" }, { key: "end", label: "Salida", className: "w-[16%]" }, { key: "status", label: "Estado", className: "w-[13%]" }, { key: "actions", label: "", className: "w-[14%] text-right" }]}
            renderDesktopRow={(session) => {
                const correction = correctionBySession.get(session.id);
                return [<span key="date" className="text-sm font-semibold text-[var(--text-main)]">{formatDate(session.start_time)}</span>, <span key="location" className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-muted)]"><MapPin className="size-4 shrink-0 text-accent" /><span className="truncate">{session.location_name || `Ubicación #${session.location_id}`}</span></span>, <span key="start" className="font-mono text-xs text-[var(--text-main)]"><DateTimeText value={session.start_time} /></span>, <span key="end" className="font-mono text-xs text-[var(--text-main)]">{session.end_time ? <DateTimeText value={session.end_time} /> : "—"}</span>, <span key="status">{correction ? <CorrectionStatus status={correction.status} /> : <Badge variant="outline">Sin cambios</Badge>}</span>, <div key="actions" className="flex justify-end">{correction?.status === "pending" ? <span className="text-xs font-medium text-[var(--text-muted)]">En revisión</span> : <Button type="button" size="sm" variant="secondary" onClick={() => setRequestingSession(session)}><FilePenLine className="size-4" />Corregir</Button>}</div>];
            }}
            renderCompactRow={(session) => {
                const correction = correctionBySession.get(session.id);
                return <div className="min-w-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-[var(--text-main)]">{formatDate(session.start_time)}</p><p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-[var(--text-muted)]"><MapPin className="size-3.5 shrink-0 text-accent" />{session.location_name || `Ubicación #${session.location_id}`}</p></div>{correction ? <CorrectionStatus status={correction.status} /> : <Badge variant="outline">Sin cambios</Badge>}</div><div className="mt-3 flex items-center justify-between gap-3 border-t border-[var(--table-divider)] pt-3"><span className="font-mono text-xs text-[var(--text-muted)]"><DateTimeText value={session.start_time} /> — {session.end_time ? <DateTimeText value={session.end_time} /> : "—"}</span>{correction?.status === "pending" ? <span className="text-xs font-medium text-[var(--text-muted)]">En revisión</span> : <Button type="button" size="sm" variant="secondary" onClick={() => setRequestingSession(session)}>Corregir</Button>}</div></div>;
            }}
            empty={<div><Clock3 className="mx-auto mb-3 size-10 text-[var(--text-muted)] opacity-50" /><p className="text-sm font-medium text-[var(--text-muted)]">Aún no tienes jornadas cerradas.</p></div>}
        /> : <DataListTable
            items={reviewQueue}
            getRowKey={(correction) => correction.id}
            desktopFrom="lg"
            header={{ title: "Solicitudes para revisar", subtitle: "Solo se muestran las peticiones de las ubicaciones incluidas en tu permiso.", countLabel: `${reviewQueue.filter((item) => item.status === "pending").length} pendientes` }}
            columns={[{ key: "person", label: "Persona", className: "w-[22%]" }, { key: "location", label: "Ubicación", className: "w-[20%]" }, { key: "current", label: "Registrado", className: "w-[20%]" }, { key: "requested", label: "Solicitado", className: "w-[20%]" }, { key: "status", label: "Estado", className: "w-[10%]" }, { key: "actions", label: "", className: "w-[8%] text-right" }]}
            renderDesktopRow={(correction) => [<span key="person" className="text-sm font-semibold text-[var(--text-main)]">{correction.requester_name || "Persona eliminada"}</span>, <span key="location" className="flex min-w-0 items-center gap-2 text-sm text-[var(--text-muted)]"><MapPin className="size-4 shrink-0 text-accent" /><span className="truncate">{correction.location_name || "Ubicación eliminada"}</span></span>, <span key="current" className="font-mono text-xs text-[var(--text-muted)]"><DateTimeText value={correction.original_start_time} /> — <DateTimeText value={correction.original_end_time} /></span>, <span key="requested" className="font-mono text-xs text-[var(--text-main)]"><DateTimeText value={correction.requested_start_time} /> — <DateTimeText value={correction.requested_end_time} /></span>, <span key="status"><CorrectionStatus status={correction.status} /></span>, <div key="actions" className="flex justify-end">{correction.status === "pending" && <Button type="button" size="sm" variant="secondary" onClick={() => setReviewingCorrection(correction)}>Revisar</Button>}</div>]}
            renderCompactRow={(correction) => <div className="min-w-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{correction.requester_name || "Persona eliminada"}</p><p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-[var(--text-muted)]"><MapPin className="size-3.5 shrink-0 text-accent" />{correction.location_name || "Ubicación eliminada"}</p></div><CorrectionStatus status={correction.status} /></div><p className="mt-3 border-t border-[var(--table-divider)] pt-3 text-xs text-[var(--text-muted)]">Solicitado: <DateTimeText value={correction.requested_start_time} /> — <DateTimeText value={correction.requested_end_time} /></p>{correction.status === "pending" && <div className="mt-3 flex justify-end"><Button type="button" size="sm" variant="secondary" onClick={() => setReviewingCorrection(correction)}>Revisar</Button></div>}</div>}
            empty={<div><ClipboardCheck className="mx-auto mb-3 size-10 text-[var(--text-muted)] opacity-50" /><p className="text-sm font-medium text-[var(--text-muted)]">No hay correcciones pendientes en tus ubicaciones.</p></div>}
        />}
        <RequestCorrectionDialog key={requestingSession?.id ?? "no-request"} session={requestingSession} open={requestingSession !== null} onOpenChange={(open) => { if (!open) setRequestingSession(null); }} onRequested={(correction) => { setCorrections((current) => [correction, ...current]); window.dispatchEvent(new Event("workhive:session-changed")); }} />
        <ReviewCorrectionDialog key={reviewingCorrection?.id ?? "no-review"} correction={reviewingCorrection} open={reviewingCorrection !== null} onOpenChange={(open) => { if (!open) setReviewingCorrection(null); }} onReviewed={replaceCorrection} />
    </div>;
}
