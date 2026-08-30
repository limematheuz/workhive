"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { isPlatformSuperadmin } from "@/domain/access/roles";
import {
    TrialRequest,
    TrialRequestApprove,
    TrialRequestService,
} from "@/services/trial-request.service";

type ApprovalForm = TrialRequestApprove;

const defaultApprovalForm = (request: TrialRequest | null): ApprovalForm => ({
    access_mode: "trial",
    trial_days: request?.requested_trial_days || 14,
    tax_id: "",
    address: "",
    phone: request?.phone || "",
    company_email: request?.email || "",
    owner_full_name: request?.full_name || "",
    note: "",
});

const TRIAL_REQUEST_STATUS_STYLES: Record<string, string> = {
    pending_email_verification: "border-amber-500/20 bg-amber-500/10 text-amber-600",
    email_verified: "border-accent/25 bg-accent/10 text-accent",
    approved: "border-accent/25 bg-accent/10 text-accent",
    rejected: "border-red-500/20 bg-red-500/10 text-red-600",
    expired: "border-[var(--border-soft)] bg-[var(--bg-tertiary)] text-[var(--text-muted)]",
};

const COPY = {
    title: "Solicitudes de acceso",
    subtitle: "Verificación de email, aprobación y activación de cuenta.",
    ready: (count: number) => `${count} listas para revisar`,
    loading: "Cargando solicitudes de acceso…",
    empty: "No hay solicitudes de acceso para revisar.",
    status: {
        pending_email_verification: "Pendiente de verificar email",
        email_verified: "Lista para revisar",
        approved: "Aprobada",
        rejected: "Rechazada",
        expired: "Caducada",
    } as Record<string, string>,
    approve: "Aprobar",
    reject: "Rechazar",
    approveTitle: "Aprobar solicitud de acceso",
    initialPlan: "Plan inicial",
    trialDays: "Días de prueba",
    taxId: "CIF / NIF",
    phone: "Teléfono",
    companyEmail: "Email de la empresa",
    owner: "Administrador de la empresa",
    address: "Dirección legal",
    cancel: "Cancelar",
    approveSubmit: "Aprobar solicitud",
    approving: "Aprobando…",
    rejectTitle: "Rechazar solicitud de acceso",
    rejectNote: "Nota opcional sobre la decisión",
    rejecting: "Rechazando…",
    approved: "Solicitud aprobada. Se ha enviado un email seguro para crear la contraseña.",
    rejected: "Solicitud rechazada.",
    loadError: "No se han podido cargar las solicitudes de acceso.",
    approveError: "No se ha podido aprobar la solicitud de acceso.",
    rejectError: "No se ha podido rechazar la solicitud de acceso.",
};

export function TrialRequestsPanel() {
    const { user } = useUser();
    const [requests, setRequests] = useState<TrialRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<TrialRequest | null>(null);
    const [approvalForm, setApprovalForm] = useState<ApprovalForm>(() => defaultApprovalForm(null));
    const [rejectTarget, setRejectTarget] = useState<TrialRequest | null>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const pendingCount = useMemo(
        () => requests.filter((request) => request.status === "email_verified").length,
        [requests]
    );
    const visibleRequests = useMemo(
        () => requests.filter((request) => !["approved", "rejected"].includes(request.status)),
        [requests]
    );

    const loadRequests = useCallback(async () => {
        try {
            const data = await TrialRequestService.list();
            setRequests(data);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : COPY.loadError);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isPlatformSuperadmin(user)) {
            startTransition(() => setLoading(false));
            return;
        }
        startTransition(() => {
            void loadRequests();
        });
    }, [loadRequests, user]);

    if (!isPlatformSuperadmin(user)) {
        return null;
    }

    const openApproval = (request: TrialRequest) => {
        setSelectedRequest(request);
        setApprovalForm(defaultApprovalForm(request));
    };

    const handleApprove = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!selectedRequest) return;
        try {
            setSubmitting(true);
            const updated = await TrialRequestService.approve(selectedRequest.id, approvalForm);
            setRequests((prev) => prev.filter((request) => request.id !== updated.id));
            setSelectedRequest(null);
            toast.success(COPY.approved);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : COPY.approveError);
        } finally {
            setSubmitting(false);
        }
    };

    const handleReject = async () => {
        if (!rejectTarget) return;
        try {
            setSubmitting(true);
            const updated = await TrialRequestService.reject(rejectTarget.id, rejectNote);
            setRequests((prev) => prev.filter((request) => request.id !== updated.id));
            setRejectTarget(null);
            setRejectNote("");
            toast.success(COPY.rejected);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : COPY.rejectError);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="billing-surface relative overflow-hidden rounded-[24px] p-3.5 sm:p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--text-main)]">
                            {COPY.title}
                        </h3>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {COPY.subtitle}
                        </p>
                    </div>
                </div>
                <Badge
                    variant="outline"
                    className="w-fit border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent"
                >
                    {COPY.ready(pendingCount)}
                </Badge>
            </div>

            {loading ? (
                <p className="py-4 text-center text-xs text-[var(--text-muted)]">{COPY.loading}</p>
            ) : visibleRequests.length === 0 ? (
                <div className="billing-block rounded-2xl px-4 py-6 text-center">
                    <p className="text-sm text-[var(--text-muted)]">{COPY.empty}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {visibleRequests.slice(0, 8).map((request) => (
                        <article
                            key={request.id}
                            className="billing-block rounded-2xl border border-[var(--border-soft)] p-3.5"
                        >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="text-sm font-semibold text-[var(--text-main)]">
                                            {request.company_name}
                                        </h4>
                                        <Badge
                                            variant="outline"
                                            className={`${TRIAL_REQUEST_STATUS_STYLES[request.status] || TRIAL_REQUEST_STATUS_STYLES.expired} text-[10px] font-semibold uppercase`}
                                        >
                                            {COPY.status[request.status] || request.status}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                                        {request.full_name} · {request.email}
                                    </p>
                                    <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                                        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                        {new Date(request.created_at).toLocaleString("es-ES", {
                                            timeZone: "UTC",
                                        })}
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        size="sm"
                                        disabled={request.status !== "email_verified"}
                                        onClick={() => openApproval(request)}
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        {COPY.approve}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="dangerSoft"
                                        disabled={request.status === "approved" || request.status === "rejected"}
                                        onClick={() => setRejectTarget(request)}
                                    >
                                        <XCircle className="h-4 w-4" />
                                        {COPY.reject}
                                    </Button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                <DialogContent className="max-h-[calc(100vh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] overflow-y-auto sm:max-w-[640px]">
                    <form onSubmit={handleApprove} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>{COPY.approveTitle}</DialogTitle>
                            <p className="text-sm text-[var(--text-muted)]">
                                {selectedRequest?.company_name} · {selectedRequest?.email}
                            </p>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="min-w-0 space-y-2">
                                <Label htmlFor="trial-request-plan">{COPY.initialPlan}</Label>
                                <Select
                                    value={approvalForm.access_mode}
                                    onValueChange={(value) => setApprovalForm({
                                        ...approvalForm,
                                        access_mode: value as ApprovalForm["access_mode"],
                                    })}
                                >
                                    <SelectTrigger id="trial-request-plan"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="trial">Prueba (Top)</SelectItem>
                                        <SelectItem value="basic">Basic</SelectItem>
                                        <SelectItem value="medium">Medium</SelectItem>
                                        <SelectItem value="top">Top</SelectItem>
                                        <SelectItem value="mega">Enterprise</SelectItem>
                                        <SelectItem value="custom">Personalizado</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <TrialInput
                                id="trial-request-trial-days"
                                label={COPY.trialDays}
                                type="number"
                                disabled={approvalForm.access_mode !== "trial"}
                                value={approvalForm.trial_days?.toString() || ""}
                                onChange={(value) => setApprovalForm({ ...approvalForm, trial_days: Number(value) || 14 })}
                            />
                            <TrialInput id="trial-request-tax-id" label={COPY.taxId} value={approvalForm.tax_id} onChange={(tax_id) => setApprovalForm({ ...approvalForm, tax_id })} />
                            <TrialInput id="trial-request-phone" label={COPY.phone} value={approvalForm.phone} onChange={(phone) => setApprovalForm({ ...approvalForm, phone })} />
                            <TrialInput id="trial-request-company-email" label={COPY.companyEmail} type="email" value={approvalForm.company_email || ""} onChange={(company_email) => setApprovalForm({ ...approvalForm, company_email })} />
                            <TrialInput id="trial-request-owner" label={COPY.owner} value={approvalForm.owner_full_name || ""} onChange={(owner_full_name) => setApprovalForm({ ...approvalForm, owner_full_name })} />
                            <TrialInput id="trial-request-address" label={COPY.address} value={approvalForm.address} onChange={(address) => setApprovalForm({ ...approvalForm, address })} wide />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setSelectedRequest(null)}
                            >
                                {COPY.cancel}
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? COPY.approving : COPY.approveSubmit}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
                <DialogContent className="w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{COPY.rejectTitle}</DialogTitle>
                    </DialogHeader>
                    <Label className="sr-only" htmlFor="trial-rejection-note">
                        {COPY.rejectNote}
                    </Label>
                    <Textarea
                        id="trial-rejection-note"
                        value={rejectNote}
                        onChange={(event) => setRejectNote(event.target.value)}
                        className="min-h-28"
                        placeholder={COPY.rejectNote}
                    />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setRejectTarget(null)}
                        >
                            {COPY.cancel}
                        </Button>
                        <Button
                            type="button"
                            disabled={submitting}
                            onClick={handleReject}
                            variant="destructive"
                        >
                            {submitting ? COPY.rejecting : COPY.reject}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}

function TrialInput({
    id,
    label,
    value,
    onChange,
    type = "text",
    disabled = false,
    wide = false,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    disabled?: boolean;
    wide?: boolean;
}) {
    return (
        <div className={`min-w-0 space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type={type}
                required={!disabled}
                disabled={disabled}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-11 rounded-xl"
            />
        </div>
    );
}
