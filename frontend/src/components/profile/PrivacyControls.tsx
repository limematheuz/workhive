"use client";

import { startTransition, useCallback, useEffect, useState } from "react";
import { Download, Loader2, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import {
    PendingPrivacyRequests,
    PrivacyResolutionDialog,
} from "./PrivacyRequestManagement";
import {
    PrivacyRequest,
    PrivacyService,
} from "@/services/privacy.service";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";
import { PAGE_ACTION_BUTTON_BASE, PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";


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
            setLoading(false);
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
        <section className="billing-surface billing-surface-accent-pad relative overflow-hidden rounded-[24px]">
            <div className="absolute left-4 right-4 top-3 h-1.5 rounded-full bg-accent" aria-hidden="true" />
            <div className="relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-start">
                <div className="max-w-2xl">
                    <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-tertiary)] text-accent">
                            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <div>
                            <h3 className="text-base font-semibold text-[var(--text-main)]">
                                {isSpanish ? "Privacidad y tus datos" : "Privacy and your data"}
                            </h3>
                            <p className="mt-0.5 text-xs leading-5 text-[var(--text-muted)]">
                                {isSpanish
                                    ? "Descarga una copia portable de tus datos o ejerce tus derechos RGPD. Las solicitudes quedan registradas y auditadas."
                                    : "Download a portable copy of your data or exercise your GDPR rights. Requests are recorded and audited."}
                            </p>
                        </div>
                    </div>
                    {!loading && openRequest && (
                        <p className="mt-3 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            {isSpanish
                                ? "Ya existe una solicitud de supresión pendiente."
                                : "An erasure request is already pending."}
                        </p>
                    )}
                </div>
                <div className="flex shrink-0 flex-col gap-2.5 sm:flex-row">
                    <button
                        type="button"
                        onClick={exportData}
                        disabled={working !== null}
                        className={PAGE_ACTION_BUTTON_PRIMARY}
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
                        className={`${PAGE_ACTION_BUTTON_BASE} border-red-500/30 bg-red-500/10 text-red-600 hover:border-red-600 hover:bg-red-600 hover:text-white`}
                    >
                        {working === "erasure"
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Trash2 className="h-4 w-4" />}
                        {isSpanish ? "Solicitar supresión" : "Request erasure"}
                    </button>
                </div>
            </div>
            {canManageRequests && (
                <PendingPrivacyRequests
                    requests={pendingCompanyRequests}
                    isSpanish={isSpanish}
                    onResolve={openResolveDialog}
                />
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
            <PrivacyResolutionDialog
                target={resolveTarget}
                decision={resolveDecision}
                notes={resolutionNotes}
                resolving={resolving}
                isSpanish={isSpanish}
                onNotesChange={setResolutionNotes}
                onClose={closeResolveDialog}
                onResolve={resolveRequest}
            />
        </section>
    );
}
