"use client";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { getPrivacyRequestTypeLabel } from "@/lib/privacy-request";
import { Textarea } from "@/components/ui/textarea";
import type { PrivacyRequest } from "@/services/privacy.service";

type Decision = "complete" | "reject";

type PendingPrivacyRequestsProps = {
    requests: PrivacyRequest[];
    isSpanish: boolean;
    onResolve: (request: PrivacyRequest, decision: Decision) => void;
};

export function PendingPrivacyRequests({
    requests,
    isSpanish,
    onResolve,
}: PendingPrivacyRequestsProps) {
    if (requests.length === 0) return null;

    return (
        <div className="relative z-10 mt-5 border-t border-[var(--border-soft)] pt-5">
            <h4 className="mb-3 text-sm font-semibold text-[var(--text-main)]">
                {isSpanish ? "Solicitudes pendientes de la empresa" : "Pending company requests"}
            </h4>
            <div className="space-y-2.5">
                {requests.map((request) => (
                    <div
                        key={request.id}
                        className="billing-block flex flex-col justify-between gap-3 rounded-xl p-3.5 sm:flex-row sm:items-center"
                    >
                        <div>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
                                {getPrivacyRequestTypeLabel(request.request_type, isSpanish)} #{request.id}
                            </p>
                            <p className="mt-1 text-xs text-[var(--text-muted)]">
                                {new Date(request.requested_at).toLocaleString(
                                    isSpanish ? "es-ES" : "en-US",
                                    { timeZone: "UTC" },
                                )}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => onResolve(request, "reject")}
                                className="inline-flex h-8 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-sm font-medium text-red-600 shadow-sm ui-motion hover:-translate-y-0.5 hover:border-red-600 hover:bg-red-600 hover:text-white hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                            >
                                {isSpanish ? "Rechazar" : "Reject"}
                            </button>
                            <button
                                type="button"
                                onClick={() => onResolve(request, "complete")}
                                className="inline-flex h-8 items-center justify-center rounded-xl border border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] px-3 text-sm font-medium text-[var(--btn-primary-text)] shadow-sm ui-motion hover:-translate-y-0.5 hover:bg-[var(--btn-primary-hover-bg)] hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-color)]"
                            >
                                {isSpanish ? "Completar" : "Complete"}
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

type PrivacyResolutionDialogProps = {
    target: PrivacyRequest | null;
    decision: Decision | null;
    notes: string;
    resolving: boolean;
    isSpanish: boolean;
    onNotesChange: (notes: string) => void;
    onClose: () => void;
    onResolve: () => void;
};

export function PrivacyResolutionDialog({
    target,
    decision,
    notes,
    resolving,
    isSpanish,
    onNotesChange,
    onClose,
    onResolve,
}: PrivacyResolutionDialogProps) {
    return (
        <Dialog open={Boolean(target)} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border-soft)] text-[var(--text-main)] sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {decision === "complete"
                            ? (isSpanish ? "Completar solicitud" : "Complete request")
                            : (isSpanish ? "Rechazar solicitud" : "Reject request")}
                    </DialogTitle>
                    <DialogDescription className="text-[var(--text-muted)]">
                        {decision === "complete" && target?.request_type === "erasure"
                            ? (isSpanish
                                ? "Se anonimizará la cuenta y se revocarán sus sesiones. Los registros legales o fiscales obligatorios se conservarán. El mensaje se enviará por email a la persona."
                                : "The account will be anonymized and sessions revoked. Legally required fiscal records will be retained. The message will be emailed to the person.")
                            : (isSpanish
                                ? "Este mensaje se enviará por email a la persona que hizo la solicitud. No incluyas notas internas."
                                : "This message will be emailed to the person who made the request. Do not include internal notes.")}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <label htmlFor="privacy-resolution-notes" className="text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]">
                        {isSpanish ? "Mensaje para la persona" : "Message for the person"}
                    </label>
                    <Textarea
                        id="privacy-resolution-notes"
                        value={notes}
                        onChange={(event) => onNotesChange(event.target.value)}
                        className="min-h-28 w-full rounded-xl bg-[var(--bg-tertiary)] p-3 text-sm ui-motion focus:border-[var(--border-color)] focus:ring-2 focus:ring-[var(--border-soft)]"
                        placeholder={isSpanish ? "Ej.: Hemos verificado tu solicitud. Conservaremos únicamente los registros fiscales exigidos por ley." : "E.g. We verified your request. We will retain only legally required fiscal records."}
                    />
                </div>
                <DialogFooter className="gap-2">
                    <button type="button" onClick={onClose} disabled={resolving} className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--btn-neutral-border)] bg-[var(--btn-neutral-bg)] px-4 text-sm font-medium text-[var(--btn-neutral-text)] ui-motion hover:bg-[var(--btn-neutral-hover-bg)] hover:text-[var(--text-main)] disabled:opacity-50">
                        {isSpanish ? "Cancelar" : "Cancel"}
                    </button>
                    <button
                        type="button"
                        disabled={resolving || !notes.trim()}
                        onClick={onResolve}
                        className={decision === "reject"
                            ? "inline-flex h-9 items-center justify-center rounded-xl border border-red-600 bg-red-600 px-4 text-sm font-medium text-white shadow-sm ui-motion hover:-translate-y-0.5 hover:border-red-700 hover:bg-red-700 hover:text-white hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                            : "inline-flex h-9 items-center justify-center rounded-xl border border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] px-4 text-sm font-medium text-[var(--btn-primary-text)] shadow-sm ui-motion hover:-translate-y-0.5 hover:bg-[var(--btn-primary-hover-bg)] hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"}
                    >
                        {resolving
                            ? (isSpanish ? "Guardando..." : "Saving...")
                            : decision === "reject"
                                ? (isSpanish ? "Rechazar" : "Reject")
                                : (isSpanish ? "Completar" : "Complete")}
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
