"use client";

import { Suspense, startTransition, useCallback, useRef, useState, useEffect } from "react";
import { redirect, useRouter, useSearchParams } from "next/navigation";
import { FileText, Loader2, Plus } from "lucide-react";

import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { QuoteCreateSheet } from "@/components/quotes/QuoteCreateSheet";
import { QuoteDetailSheet } from "@/components/quotes/QuoteDetailSheet";
import { QuotesFiltersSection } from "@/components/quotes/QuotesFiltersSection";
import { QuotesListSection } from "@/components/quotes/QuotesListSection";
import { useDictionary } from "@/lib/dictionary-context";
import { canManageFinance, canViewFinance } from "@/domain/access/roles";
import { ApiResponseError } from "@/lib/api";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { ClientService, Client } from "@/services/client.service";
import { CompanyService } from "@/services/company.service";
import { QuoteService } from "@/services/quote.service";
import { Quote } from "@/types/quote";
import type { User } from "@/types/user";
import { useViewState } from "@/hooks/useViewState";

type QuotesLoadErrorKind = "denied" | "unavailable";

function isAccessDeniedError(error: unknown): boolean {
    return (
        error instanceof ApiResponseError
        && (error.status === 401 || error.status === 403 || error.status === 404)
    );
}

function QuotesPageLoading() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
            <span className="text-xs text-[var(--text-muted)]">Cargando presupuestos...</span>
        </div>
    );
}

function QuotesPageContent() {
    const { user, loading } = useUser();
    if (loading) return <QuotesPageLoading />;
    if (!user || !canViewFinance(user)) redirect("/dashboard");
    return <QuotesWorkspace key={`${user.id}:${user.company_id}:${user.role?.name}`} user={user} />;
}

function QuotesWorkspace({ user }: { user: User }) {
    const { dict } = useDictionary();
    const dictRef = useRef(dict);
    useEffect(() => {
        dictRef.current = dict;
    }, [dict]);
    const router = useRouter();
    const searchParams = useSearchParams();

    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useViewState("quotes.status", "");
    const [selectedClientId, setSelectedClientId] = useViewState("quotes.client", "");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [companyName, setCompanyName] = useState<string | undefined>(undefined);
    const [quoteToEdit, setQuoteToEdit] = useState<Quote | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [loadError, setLoadError] = useState<QuotesLoadErrorKind | null>(null);
    const quoteToDeleteIdRef = useRef<number | null>(null);
    const requestIdRef = useRef(0);
    const hasLoadedQuotesRef = useRef(false);
    const loadedFilterKeyRef = useRef<string | null>(null);
    const canViewQuotes = canViewFinance(user);
    const canManageQuotes = canManageFinance(user);
    const workspaceKey = user
        ? `${user.id}:${user.company_id ?? "none"}:${user.role?.name ?? "none"}`
        : "anonymous";
    const filterKey = `${workspaceKey}|client:${selectedClientId}|status:${selectedStatus}`;

    useEffect(() => {
        requestIdRef.current += 1;
        hasLoadedQuotesRef.current = false;
        loadedFilterKeyRef.current = null;
        startTransition(() => {
            setQuotes([]);
            setClients([]);
            setSelectedQuote(null);
            setIsDetailOpen(false);
            setLoadError(null);
        });
    }, [workspaceKey]);

    useEffect(() => {
        if (!canViewQuotes) return;
        let cancelled = false;

        const load = async () => {
            const [clientsResult, companyResult] = await Promise.allSettled([
                ClientService.getClients(true, `quotes:${workspaceKey}:clients`),
                user.company_id ? CompanyService.getCompany(user.company_id) : Promise.resolve(null),
            ]);
            if (cancelled) return;
            if (clientsResult.status === "fulfilled") {
                setClients(clientsResult.value);
            }
            if (companyResult.status === "fulfilled" && companyResult.value) {
                setCompanyName(companyResult.value.name);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [canViewQuotes, user, workspaceKey]);

    const loadQuotes = useCallback(async (options?: { silent?: boolean }) => {
        if (!canViewQuotes) return;
        const requestId = ++requestIdRef.current;
        const canReuseCurrentSnapshot = (
            hasLoadedQuotesRef.current
            && loadedFilterKeyRef.current === filterKey
        );
        try {
            if (!options?.silent) {
                setLoading(true);
                if (!canReuseCurrentSnapshot) {
                    setQuotes([]);
                }
            }
            const data = await QuoteService.getQuotes({
                clientId: selectedClientId ? parseInt(selectedClientId) : undefined,
                status: selectedStatus || undefined,
            }, `quotes:${filterKey}:${requestId}`);
            if (requestId !== requestIdRef.current) return;
            hasLoadedQuotesRef.current = true;
            loadedFilterKeyRef.current = filterKey;
            setLoadError(null);
            setQuotes(data);
            setSelectedQuote((current) =>
                current ? (data.find((item) => item.id === current.id) ?? null) : null,
            );
        } catch (error: unknown) {
            if (requestId !== requestIdRef.current) return;
            const denied = isAccessDeniedError(error);
            const errorKind: QuotesLoadErrorKind = denied ? "denied" : "unavailable";
            setLoadError(errorKind);
            if (denied || !canReuseCurrentSnapshot) {
                hasLoadedQuotesRef.current = false;
                loadedFilterKeyRef.current = null;
                setQuotes([]);
                setSelectedQuote(null);
                setIsDetailOpen(false);
            }
            if (!options?.silent) {
                toast.error(
                    denied
                        ? (dictRef.current.quotes?.error_denied ?? "No tienes permisos para consultar presupuestos.")
                        : (dictRef.current.quotes?.error_load ?? "No se pudieron cargar los presupuestos."),
                );
            }
        } finally {
            setLoading(current => requestId === requestIdRef.current ? false : current);
        }
    }, [canViewQuotes, filterKey, selectedClientId, selectedStatus]);

    useEffect(() => {
        if (!canViewQuotes) return;
        startTransition(() => {
            void loadQuotes();
        });
    }, [canViewQuotes, loadQuotes]);

    useEffect(() => {
        if (!canViewQuotes) return;
        const handleRefresh = () => {
            void loadQuotes({ silent: true });
        };
        const handleRealtimeInvalidation = (event: Event) => {
            const detail = (event as CustomEvent<{ domains?: string[] }>).detail;
            if (!detail?.domains || detail.domains.includes("quotes")) {
                handleRefresh();
            }
        };
        window.addEventListener("focus", handleRefresh);
        window.addEventListener("workhive:realtime-invalidation", handleRealtimeInvalidation);
        return () => {
            window.removeEventListener("focus", handleRefresh);
            window.removeEventListener("workhive:realtime-invalidation", handleRealtimeInvalidation);
        };
    }, [canViewQuotes, loadQuotes]);

    const handleDeleteConfirm = async () => {
        const quoteToDeleteId = quoteToDeleteIdRef.current;
        if (!quoteToDeleteId) return;
        try {
            setIsDeleting(true);
            await QuoteService.deleteQuote(quoteToDeleteId);
            toast.success(dict.quotes?.deleted ?? "Presupuesto eliminado");
            setIsDeleteDialogOpen(false);
            if (selectedQuote?.id === quoteToDeleteId) {
                setSelectedQuote(null);
                setIsDetailOpen(false);
            }
            quoteToDeleteIdRef.current = null;
            void loadQuotes();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Error al eliminar el presupuesto"));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleViewQuote = async (quote: Quote) => {
        try {
            const fresh = await QuoteService.getQuote(quote.id, `quotes:${workspaceKey}:detail`);
            setSelectedQuote(fresh);
            setIsDetailOpen(true);
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, dict.quotes?.error_load ?? "No se pudo cargar el presupuesto"));
        }
    };

    const handleEditQuote = (quote: Quote) => {
        setSelectedQuote(null);
        setIsDetailOpen(false);
        setQuoteToEdit(quote);
        setIsCreateOpen(true);
    };

    useEffect(() => {
        const quoteId = Number(searchParams.get("quote"));
        if (!Number.isSafeInteger(quoteId) || quoteId < 1) return;

        let cancelled = false;
        void QuoteService.getQuote(quoteId, `quotes:${workspaceKey}:deep-link`)
            .then((quote) => {
                if (cancelled) return;
                if (canManageQuotes && searchParams.get("edit") === "true") {
                    handleEditQuote(quote);
                } else {
                    setSelectedQuote(quote);
                    setIsDetailOpen(true);
                }
                router.replace("/dashboard/quotes", { scroll: false });
            })
            .catch(() => {
                if (!cancelled) {
                    toast.error(dict.quotes?.error_load ?? "Presupuesto no encontrado");
                    router.replace("/dashboard/quotes", { scroll: false });
                }
            });
        return () => {
            cancelled = true;
        };
    }, [canManageQuotes, dict.quotes?.error_load, router, searchParams, workspaceKey]);

    const STATUS_LABELS: Record<string, string> = {
        draft: dict.quotes?.status_draft ?? "Borrador",
        sent: dict.quotes?.status_sent ?? "Enviado",
        accepted: dict.quotes?.status_accepted ?? "Aceptado",
        rejected: dict.quotes?.status_rejected ?? "Rechazado",
        expired: dict.quotes?.status_expired ?? "Vencido",
    };

    const getClientName = (q: Quote) => {
        if (q.client_id === null) {
            if (q.custom_recipient_info) {
                return q.custom_recipient_info.split("\n")[0];
            }
            return dict.quotes?.unregistered_client || "No registrado / Nuevo";
        }
        return clients.find((c: Client) => c.id === q.client_id)?.name ?? `#${q.client_id}`;
    };

    const loadErrorMessage = loadError === "denied"
        ? (dict.quotes?.error_denied ?? "No tienes permisos para consultar presupuestos.")
        : loadError === "unavailable"
            ? (dict.quotes?.error_load ?? "No se pudieron cargar los presupuestos.")
            : null;
    const retryLabel = dict.quotes?.retry ?? "Reintentar";

    if (canViewQuotes && loading && quotes.length === 0 && !loadError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
                <span className="text-xs text-[var(--text-muted)]">
                    {dict.quotes?.loading ?? "Cargando presupuestos..."}
                </span>
            </div>
        );
    }

    return (
        <div className="dashboard-page-content px-[3%] py-6 md:p-8">
            <PageHeader
                icon={FileText}
                title={dict.quotes?.list_title ?? "Presupuestos"}
                subtitle={dict.quotes?.list_subtitle ?? "Crea y gestiona presupuestos para tus clientes."}
                className="mb-8"
                actions={canManageQuotes ? (
                    <Button
                        type="button"
                        onClick={() => setIsCreateOpen(true)}
                        className={`${PAGE_ACTION_BUTTON_PRIMARY} cursor-pointer hover:translate-y-0 hover:shadow-none`}
                    >
                        <Plus className="w-4 h-4" />
                        {dict.quotes?.new_quote ?? "Nuevo Presupuesto"}
                    </Button>
                ) : undefined}
            />

            <QuotesFiltersSection
                clients={clients}
                selectedClientId={selectedClientId}
                onClientChange={setSelectedClientId}
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
                statusLabels={STATUS_LABELS}
            />

            <QuotesListSection
                quotes={quotes}
                statusLabels={STATUS_LABELS}
                emptyLabel={dict.quotes?.empty ?? "No hay presupuestos. Crea el primero."}
                errorMessage={loadErrorMessage}
                retryLabel={retryLabel}
                onRetry={() => void loadQuotes()}
                columnLabels={{
                    title: dict.quotes?.col_title ?? "Title",
                    client: dict.quotes?.col_client ?? "Client",
                    date: dict.quotes?.col_date ?? "Date",
                    total: dict.quotes?.col_total ?? "Total",
                    status: dict.quotes?.col_status ?? "Status",
                    actions: dict.quotes?.col_actions ?? "Actions",
                }}
                getClientName={getClientName}
                canManage={canManageQuotes}
                onViewQuote={handleViewQuote}
                onEditQuote={handleEditQuote}
                onDeleteQuote={(quoteId) => {
                    quoteToDeleteIdRef.current = quoteId;
                    setIsDeleteDialogOpen(true);
                }}
            />

            <QuoteCreateSheet
                open={isCreateOpen}
                onOpenChange={(open) => {
                    setIsCreateOpen(open);
                    if (!open) setQuoteToEdit(null);
                }}
                clients={clients}
                onQuoteCreated={loadQuotes}
                quoteToEdit={quoteToEdit}
            />

            <QuoteDetailSheet
                quote={selectedQuote}
                open={isDetailOpen}
                onOpenChange={(open) => {
                    setIsDetailOpen(open);
                    if (!open) setSelectedQuote(null);
                }}
                clients={clients}
                onQuoteUpdated={(updatedQuote) => {
                    if (updatedQuote) setSelectedQuote(updatedQuote);
                    void loadQuotes();
                }}
                companyName={companyName}
                canManage={canManageQuotes}
                onRevisionCreated={(quote) => {
                    setSelectedQuote(null);
                    setIsDetailOpen(false);
                    setQuoteToEdit(quote);
                    setIsCreateOpen(true);
                }}
            />

            <DeleteConfirmDialog
                open={isDeleteDialogOpen}
                onOpenChange={(open) => {
                    setIsDeleteDialogOpen(open);
                    if (!open) quoteToDeleteIdRef.current = null;
                }}
                title={dict.quotes.delete_title}
                description={dict.quotes.delete_confirm}
                onConfirm={() => void handleDeleteConfirm()}
                isDeleting={isDeleting}
                confirmText={dict.quotes.delete}
                cancelText={dict.tasks.cancel}
            />
        </div>
    );
}

export default function QuotesPage() {
    return (
        <Suspense fallback={<QuotesPageLoading />}>
            <QuotesPageContent />
        </Suspense>
    );
}
