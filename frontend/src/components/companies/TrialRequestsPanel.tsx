"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { isPlatformSuperadmin } from "@/domain/access/roles";
import {
    TrialRequest,
    TrialRequestApprove,
    TrialRequestService,
} from "@/services/trial-request.service";

const STATUS_LABELS: Record<string, string> = {
    pending_email_verification: "Pendiente de email",
    email_verified: "Email verificado",
    approved: "Aprobada",
    rejected: "Rechazada",
    expired: "Expirada",
};

const STATUS_STYLES: Record<string, string> = {
    pending_email_verification: "bg-amber-500/10 text-amber-600 border border-amber-500/20",
    email_verified: "bg-accent/10 text-accent border border-accent/20",
    approved: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20",
    rejected: "bg-red-500/10 text-red-600 border border-red-500/20",
    expired: "bg-[var(--bg-tertiary)] text-[var(--text-muted)] border border-[var(--border-color)]",
};

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
            toast.error(error instanceof Error ? error.message : "No se pudieron cargar las solicitudes");
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
            toast.success("Solicitud aprobada y acceso enviado por email");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo aprobar la solicitud");
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
            toast.success("Solicitud rechazada");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "No se pudo rechazar la solicitud");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="surface-glass-card rounded-2xl p-5">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="flex items-center gap-2 text-lg font-black">
                        <ShieldCheck className="h-5 w-5 text-accent" />
                        Solicitudes de acceso
                    </h3>
                    <p className="text-sm text-[var(--text-muted)]">
                        Verificación de email, aprobación manual y duración de prueba.
                    </p>
                </div>
                <Badge className="w-fit border border-accent/20 bg-accent/10 text-accent">
                    {pendingCount} listas para revisar
                </Badge>
            </div>

            {loading ? (
                <p className="text-sm text-[var(--text-muted)]">Cargando solicitudes...</p>
            ) : visibleRequests.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-soft)] p-6 text-sm text-[var(--text-muted)]">
                    No hay solicitudes todavía.
                </div>
            ) : (
                <div className="grid gap-3">
                    {visibleRequests.slice(0, 8).map((request) => (
                        <article
                            key={request.id}
                            className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4"
                        >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-black">{request.company_name}</h4>
                                        <Badge className={`${STATUS_STYLES[request.status] || STATUS_STYLES.expired} text-[10px] font-black uppercase`}>
                                            {STATUS_LABELS[request.status] || request.status}
                                        </Badge>
                                    </div>
                                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                                        {request.full_name} · {request.email}
                                    </p>
                                    <p className="mt-1 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                                        <Clock className="h-3.5 w-3.5" />
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
                                        className="gap-2 rounded-xl border border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--btn-primary-hover-bg)] hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                                    >
                                        <CheckCircle2 className="h-4 w-4" />
                                        Aprobar
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={request.status === "approved" || request.status === "rejected"}
                                        onClick={() => setRejectTarget(request)}
                                        className="gap-2 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-600 hover:bg-red-600 hover:text-white hover:shadow-md active:translate-y-0 focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                                    >
                                        <XCircle className="h-4 w-4" />
                                        Rechazar
                                    </Button>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}

            <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[640px]">
                    <form onSubmit={handleApprove} className="space-y-5">
                        <DialogHeader>
                            <DialogTitle>Aprobar acceso</DialogTitle>
                            <p className="text-sm text-[var(--text-muted)]">
                                {selectedRequest?.company_name} · {selectedRequest?.email}
                            </p>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>Tipo de acceso</Label>
                                <select
                                    aria-label="Tipo de acceso"
                                    value={approvalForm.access_mode}
                                    onChange={(event) => setApprovalForm({
                                        ...approvalForm,
                                        access_mode: event.target.value as ApprovalForm["access_mode"],
                                    })}
                                    className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 text-sm"
                                >
                                    <option value="trial">Prueba</option>
                                    <option value="pro">Pro</option>
                                </select>
                            </div>
                            <TrialInput
                                label="Días de prueba"
                                type="number"
                                disabled={approvalForm.access_mode !== "trial"}
                                value={approvalForm.trial_days?.toString() || ""}
                                onChange={(value) => setApprovalForm({ ...approvalForm, trial_days: Number(value) || 14 })}
                            />
                            <TrialInput label="NIF/CIF" value={approvalForm.tax_id} onChange={(tax_id) => setApprovalForm({ ...approvalForm, tax_id })} />
                            <TrialInput label="Teléfono" value={approvalForm.phone} onChange={(phone) => setApprovalForm({ ...approvalForm, phone })} />
                            <TrialInput label="Email empresa" type="email" value={approvalForm.company_email || ""} onChange={(company_email) => setApprovalForm({ ...approvalForm, company_email })} />
                            <TrialInput label="Admin" value={approvalForm.owner_full_name || ""} onChange={(owner_full_name) => setApprovalForm({ ...approvalForm, owner_full_name })} />
                            <TrialInput label="Dirección fiscal" value={approvalForm.address} onChange={(address) => setApprovalForm({ ...approvalForm, address })} wide />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={() => setSelectedRequest(null)}
                                className="rounded-xl border border-[var(--btn-neutral-border)] bg-[var(--btn-neutral-bg)] text-[var(--btn-neutral-text)] transition-all hover:bg-[var(--btn-neutral-hover-bg)] hover:text-[var(--text-main)]"
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={submitting}
                                className="rounded-xl border border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--btn-primary-hover-bg)] hover:shadow-md active:translate-y-0"
                            >
                                {submitting ? "Aprobando..." : "Aprobar y enviar acceso"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rechazar solicitud</DialogTitle>
                    </DialogHeader>
                    <textarea
                        value={rejectNote}
                        onChange={(event) => setRejectNote(event.target.value)}
                        className="min-h-28 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-sm"
                        placeholder="Motivo interno opcional"
                    />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setRejectTarget(null)}
                            className="rounded-xl border border-[var(--btn-neutral-border)] bg-[var(--btn-neutral-bg)] text-[var(--btn-neutral-text)] transition-all hover:bg-[var(--btn-neutral-hover-bg)] hover:text-[var(--text-main)]"
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            disabled={submitting}
                            onClick={handleReject}
                            className="rounded-xl border border-red-600 bg-red-600 text-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-700 hover:bg-red-700 hover:text-white hover:shadow-md active:translate-y-0 focus-visible:ring-2 focus-visible:ring-red-500/40"
                        >
                            Rechazar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}

function TrialInput({
    label,
    value,
    onChange,
    type = "text",
    disabled = false,
    wide = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    disabled?: boolean;
    wide?: boolean;
}) {
    return (
        <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
            <Label>{label}</Label>
            <Input
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
