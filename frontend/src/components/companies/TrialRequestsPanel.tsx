"use client";

import { startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, ShieldCheck, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDictionary } from "@/lib/dictionary-context";
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

export function TrialRequestsPanel() {
    const { dict } = useDictionary();
    const t = dict.companies;
    const { user } = useUser();
    const [requests, setRequests] = useState<TrialRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState<TrialRequest | null>(null);
    const [approvalForm, setApprovalForm] = useState<ApprovalForm>(() => defaultApprovalForm(null));
    const [rejectTarget, setRejectTarget] = useState<TrialRequest | null>(null);
    const [rejectNote, setRejectNote] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const statusLabels: Record<string, string> = {
        pending_email_verification: t.request_status_pending_email,
        email_verified: t.request_status_email_verified,
        approved: t.request_status_approved,
        rejected: t.request_status_rejected,
        expired: t.request_status_expired,
    };

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
            toast.error(error instanceof Error ? error.message : t.requests_load_error);
        } finally {
            setLoading(false);
        }
    }, [t.requests_load_error]);

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
            toast.success(t.request_approve_success);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t.request_approve_error);
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
            toast.success(t.request_reject_success);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : t.request_reject_error);
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
                            {t.requests_title}
                        </h3>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                            {t.requests_subtitle}
                        </p>
                    </div>
                </div>
                <Badge
                    variant="outline"
                    className="w-fit border-accent/25 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold text-accent"
                >
                    {t.requests_ready.replace("{count}", String(pendingCount))}
                </Badge>
            </div>

            {loading ? (
                <p className="py-4 text-center text-xs text-[var(--text-muted)]">{t.requests_loading}</p>
            ) : visibleRequests.length === 0 ? (
                <div className="billing-block rounded-2xl px-4 py-6 text-center">
                    <p className="text-sm text-[var(--text-muted)]">{t.requests_empty}</p>
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
                                            {statusLabels[request.status] || request.status}
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
                                        {t.request_approve}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="dangerSoft"
                                        disabled={request.status === "approved" || request.status === "rejected"}
                                        onClick={() => setRejectTarget(request)}
                                    >
                                        <XCircle className="h-4 w-4" />
                                        {t.request_reject}
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
                            <DialogTitle>{t.request_approve_title}</DialogTitle>
                            <p className="text-sm text-[var(--text-muted)]">
                                {selectedRequest?.company_name} · {selectedRequest?.email}
                            </p>
                        </DialogHeader>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label>{t.request_access_mode}</Label>
                                <select
                                    aria-label={t.request_access_mode}
                                    value={approvalForm.access_mode}
                                    onChange={(event) => setApprovalForm({
                                        ...approvalForm,
                                        access_mode: event.target.value as ApprovalForm["access_mode"],
                                    })}
                                    className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3 text-sm"
                                >
                                    <option value="trial">{t.request_access_trial}</option>
                                    <option value="pro">{t.request_access_pro}</option>
                                </select>
                            </div>
                            <TrialInput
                                label={t.request_trial_days}
                                type="number"
                                disabled={approvalForm.access_mode !== "trial"}
                                value={approvalForm.trial_days?.toString() || ""}
                                onChange={(value) => setApprovalForm({ ...approvalForm, trial_days: Number(value) || 14 })}
                            />
                            <TrialInput label={t.cif} value={approvalForm.tax_id} onChange={(tax_id) => setApprovalForm({ ...approvalForm, tax_id })} />
                            <TrialInput label={t.phone} value={approvalForm.phone} onChange={(phone) => setApprovalForm({ ...approvalForm, phone })} />
                            <TrialInput label={t.email_label} type="email" value={approvalForm.company_email || ""} onChange={(company_email) => setApprovalForm({ ...approvalForm, company_email })} />
                            <TrialInput label={t.request_owner} value={approvalForm.owner_full_name || ""} onChange={(owner_full_name) => setApprovalForm({ ...approvalForm, owner_full_name })} />
                            <TrialInput label={t.address_label} value={approvalForm.address} onChange={(address) => setApprovalForm({ ...approvalForm, address })} wide />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setSelectedRequest(null)}
                            >
                                {t.cancel}
                            </Button>
                            <Button type="submit" disabled={submitting}>
                                {submitting ? t.request_approving : t.request_approve_submit}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t.request_reject_title}</DialogTitle>
                    </DialogHeader>
                    <label className="sr-only" htmlFor="trial-rejection-note">
                        {t.request_reject_note}
                    </label>
                    <textarea
                        id="trial-rejection-note"
                        value={rejectNote}
                        onChange={(event) => setRejectNote(event.target.value)}
                        className="min-h-28 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-sm"
                        placeholder={t.request_reject_note}
                    />
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => setRejectTarget(null)}
                        >
                            {t.cancel}
                        </Button>
                        <Button
                            type="button"
                            disabled={submitting}
                            onClick={handleReject}
                            className="rounded-xl border border-red-600 bg-red-600 text-white shadow-sm ui-motion hover:-translate-y-0.5 hover:border-red-700 hover:bg-red-700 hover:text-white hover:shadow-md active:translate-y-0 focus-visible:ring-2 focus-visible:ring-red-500/40"
                        >
                            {t.request_reject}
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
