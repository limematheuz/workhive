"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { Download, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    PrivacyRequest,
    PrivacyService,
} from "@/services/privacy.service";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";


interface PrivacyControlsProps {
    locale: string;
    canManageRequests: boolean;
}


export function PrivacyControls({
    locale,
    canManageRequests,
}: PrivacyControlsProps) {
    const [requests, setRequests] = useState<PrivacyRequest[]>([]);
    const [companyRequests, setCompanyRequests] = useState<PrivacyRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [working, setWorking] = useState<"export" | "erasure" | null>(null);
    const [erasureDialogOpen, setErasureDialogOpen] = useState(false);
    const [resolveTarget, setResolveTarget] = useState<PrivacyRequest | null>(null);
    const [resolveDecision, setResolveDecision] = useState<"complete" | "reject" | null>(null);
    const [resolutionNotes, setResolutionNotes] = useState("");
    const [resolving, setResolving] = useState(false);
    const isSpanish = locale === "es";

    const loadPrivacyRequests = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [myRequests, managedRequests] = await Promise.all([
                PrivacyService.listMyRequests(),
                canManageRequests
                    ? PrivacyService.listCompanyRequests()
                    : Promise.resolve([] as PrivacyRequest[]),
            ]);
            setRequests(myRequests);
            setCompanyRequests(managedRequests);
        } catch {
            // Keep polling quiet; direct actions show their own toast.
        } finally {
            if (!silent) setLoading(false);
        }
    }, [canManageRequests]);

    useEffect(() => {
        startTransition(() => {
            void loadPrivacyRequests();
        });
    }, [loadPrivacyRequests]);

    useBackgroundPolling(
        () => loadPrivacyRequests(true),
        POLL_INTERVALS.privacy,
    );

    const exportData = async () => {
        setWorking("export");
        try {
            await PrivacyService.exportMyData();
            toast.success(
                isSpanish ? "Exportación descargada" : "Export downloaded",
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Export failed");
        } finally {
            setWorking(null);
        }
    };

    const requestErasure = async () => {
        setWorking("erasure");
        try {
            const created = await PrivacyService.createRequest("erasure");
            setRequests((current) => [created, ...current]);
            setErasureDialogOpen(false);
            void loadPrivacyRequests(true);
            toast.success(
                isSpanish ? "Solicitud registrada" : "Request submitted",
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Request failed");
        } finally {
            setWorking(null);
        }
    };

    const openRequest = requests.find(
        (item) => item.request_type === "erasure"
            && ["pending", "processing"].includes(item.status),
    );

    const openResolveDialog = (
        request: PrivacyRequest,
        decision: "complete" | "reject",
    ) => {
        setResolveTarget(request);
        setResolveDecision(decision);
        setResolutionNotes("");
    };

    const closeResolveDialog = () => {
        setResolveTarget(null);
        setResolveDecision(null);
        setResolutionNotes("");
    };

    const resolveRequest = async () => {
        if (!resolveTarget || !resolveDecision || !resolutionNotes.trim()) return;
        try {
            setResolving(true);
            const resolved = await PrivacyService.resolveRequest(
                resolveTarget.id,
                resolveDecision,
                resolutionNotes.trim(),
            );
            setCompanyRequests((current) => current.map((item) => (
                item.id === resolved.id ? resolved : item
            )));
            void loadPrivacyRequests(true);
            closeResolveDialog();
            toast.success(
                isSpanish ? "Solicitud resuelta" : "Request resolved",
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Request failed");
        } finally {
            setResolving(false);
        }
    };

    const pendingCompanyRequests = companyRequests.filter(
        (item) => ["pending", "processing"].includes(item.status),
    );

    return (
        <section className="relative overflow-hidden bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-3xl p-6 md:p-8 shadow-xl">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="max-w-2xl">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="h-5 w-5 text-accent" />
                        <h3 className="text-lg font-black tracking-tight">
                            {isSpanish ? "Privacidad y tus datos" : "Privacy and your data"}
                        </h3>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {isSpanish
                            ? "Descarga una copia portable de tus datos o ejerce tus derechos RGPD. Las solicitudes quedan registradas y auditadas."
                            : "Download a portable copy of your data or exercise your GDPR rights. Requests are recorded and audited."}
                    </p>
                    {!loading && openRequest && (
                        <p className="mt-3 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            {isSpanish
                                ? "Ya existe una solicitud de supresión pendiente."
                                : "An erasure request is already pending."}
                        </p>
                    )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        type="button"
                        onClick={exportData}
                        disabled={working !== null}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] px-5 py-2.5 text-xs font-semibold text-[var(--btn-primary-text)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--btn-primary-hover-bg)] hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                        {working === "export"
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Download className="h-4 w-4" />}
                        {isSpanish ? "Exportar mis datos" : "Export my data"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setErasureDialogOpen(true)}
                        disabled={working !== null || Boolean(openRequest)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-xs font-semibold text-red-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-600 hover:bg-red-600 hover:text-white hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                        {working === "erasure"
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        {isSpanish ? "Solicitar supresión" : "Request erasure"}
                    </button>
                </div>
            </div>
            {canManageRequests && pendingCompanyRequests.length > 0 && (
                <div className="mt-6 pt-6 border-t border-[var(--border-soft)]">
                    <h4 className="text-sm font-black mb-3">
                        {isSpanish
                            ? "Solicitudes pendientes de la empresa"
                            : "Pending company requests"}
                    </h4>
                    <div className="space-y-3">
                        {pendingCompanyRequests.map((request) => (
                            <div
                                key={request.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] p-4"
                            >
                                <div>
                                    <p className="text-xs font-bold uppercase">
                                        {request.request_type} #{request.id}
                                    </p>
                                    <p className="text-xs text-[var(--text-muted)] mt-1">
                                        {new Date(request.requested_at).toLocaleString(
                                            isSpanish ? "es-ES" : "en-US",
                                            { timeZone: "UTC" },
                                        )}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => openResolveDialog(request, "reject")}
                                        className="inline-flex h-8 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-3 text-sm font-medium text-red-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-600 hover:bg-red-600 hover:text-white hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
                                    >
                                        {isSpanish ? "Rechazar" : "Reject"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => openResolveDialog(request, "complete")}
                                        className="inline-flex h-8 items-center justify-center rounded-xl border border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] px-3 text-sm font-medium text-[var(--btn-primary-text)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--btn-primary-hover-bg)] hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-color)]"
                                    >
                                        {isSpanish ? "Completar" : "Complete"}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <DeleteConfirmDialog
                open={erasureDialogOpen}
                onOpenChange={setErasureDialogOpen}
                title={
                    isSpanish
                        ? "Solicitar supresión de la cuenta"
                        : "Request account erasure"
                }
                description={
                    isSpanish
                        ? "Se abrirá una solicitud de supresión. Un administrador deberá verificarla y los registros legales o fiscales se conservarán cuando sea obligatorio. ¿Continuar?"
                        : "This opens an erasure request. An administrator must verify it, and legally required fiscal records will be retained. Continue?"
                }
                onConfirm={requestErasure}
                isDeleting={working === "erasure"}
                confirmText={isSpanish ? "Solicitar supresión" : "Request erasure"}
                cancelText={isSpanish ? "Cancelar" : "Cancel"}
                confirmIcon={Trash2}
                confirmVariant="danger"
            />
            <Dialog open={Boolean(resolveTarget)} onOpenChange={(open) => !open && closeResolveDialog()}>
                <DialogContent className="w-[calc(100vw-2rem)] rounded-2xl border border-[var(--border-soft)] text-[var(--text-main)] sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {resolveDecision === "complete"
                                ? (isSpanish ? "Completar solicitud" : "Complete request")
                                : (isSpanish ? "Rechazar solicitud" : "Reject request")}
                        </DialogTitle>
                        <DialogDescription className="text-[var(--text-muted)]">
                            {resolveDecision === "complete" && resolveTarget?.request_type === "erasure"
                                ? (isSpanish
                                    ? "Se anonimizará la cuenta y se revocarán sus sesiones. Los registros legales o fiscales obligatorios se conservarán. El mensaje se enviará por email a la persona."
                                    : "The account will be anonymized and sessions revoked. Legally required fiscal records will be retained. The message will be emailed to the person.")
                                : (isSpanish
                                    ? "Este mensaje se enviará por email a la persona que hizo la solicitud. No incluyas notas internas."
                                    : "This message will be emailed to the person who made the request. Do not include internal notes.")}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        <label
                            htmlFor="privacy-resolution-notes"
                            className="text-xs font-black uppercase tracking-[0.14em] text-[var(--text-muted)]"
                        >
                            {isSpanish ? "Mensaje para la persona" : "Message for the person"}
                        </label>
                        <textarea
                            id="privacy-resolution-notes"
                            value={resolutionNotes}
                            onChange={(event) => setResolutionNotes(event.target.value)}
                            className="min-h-28 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-3 text-sm outline-none transition-all focus:border-[var(--border-color)] focus:ring-2 focus:ring-[var(--border-soft)]"
                            placeholder={isSpanish ? "Ej.: Hemos verificado tu solicitud. Conservaremos únicamente los registros fiscales exigidos por ley." : "E.g. We verified your request. We will retain only legally required fiscal records."}
                        />
                    </div>
                    <DialogFooter className="gap-2">
                        <button
                            type="button"
                            onClick={closeResolveDialog}
                            disabled={resolving}
                            className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--btn-neutral-border)] bg-[var(--btn-neutral-bg)] px-4 text-sm font-medium text-[var(--btn-neutral-text)] transition-all hover:bg-[var(--btn-neutral-hover-bg)] hover:text-[var(--text-main)] disabled:opacity-50"
                        >
                            {isSpanish ? "Cancelar" : "Cancel"}
                        </button>
                        <button
                            type="button"
                            disabled={resolving || !resolutionNotes.trim()}
                            onClick={resolveRequest}
                            className={resolveDecision === "reject"
                                ? "inline-flex h-9 items-center justify-center rounded-xl border border-red-600 bg-red-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-700 hover:bg-red-700 hover:text-white hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
                                : "inline-flex h-9 items-center justify-center rounded-xl border border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] px-4 text-sm font-medium text-[var(--btn-primary-text)] shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--btn-primary-hover-bg)] hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"}
                        >
                            {resolving
                                ? (isSpanish ? "Guardando..." : "Saving...")
                                : resolveDecision === "reject"
                                    ? (isSpanish ? "Rechazar" : "Reject")
                                    : (isSpanish ? "Completar" : "Complete")}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
