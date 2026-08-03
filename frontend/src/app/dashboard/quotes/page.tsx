"use client";

import { startTransition, useCallback, useRef, useState, useEffect } from "react";
import { redirect } from "next/navigation";
import { FileText, Loader2, Plus } from "lucide-react";

import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { QuoteCreateSheet } from "@/components/quotes/QuoteCreateSheet";
import { QuoteDetailSheet } from "@/components/quotes/QuoteDetailSheet";
import { QuotesFiltersSection } from "@/components/quotes/QuotesFiltersSection";
import { QuotesListSection } from "@/components/quotes/QuotesListSection";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { ClientService, Client } from "@/services/client.service";
import { CompanyService } from "@/services/company.service";
import { QuoteService } from "@/services/quote.service";
import { Quote } from "@/types/quote";

export default function QuotesPage() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();

    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState("");
    const [selectedClientId, setSelectedClientId] = useState("");
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [companyName, setCompanyName] = useState<string | undefined>(undefined);
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const [quoteToEdit, setQuoteToEdit] = useState<Quote | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const quoteToDeleteIdRef = useRef<number | null>(null);

    if (!userLoading && (!user || (user.role?.name !== "admin" && user.role?.name !== "superadmin"))) {
        redirect("/dashboard");
    }

    useEffect(() => {
        if (userLoading || !user) return;
        let cancelled = false;

        const load = async () => {
            try {
                const [clientsData] = await Promise.all([ClientService.getClients()]);
                if (cancelled) return;
                setClients(clientsData);

                if (user.company_id) {
                    const company = await CompanyService.getCompany(user.company_id);
                    if (cancelled) return;
                    setCompanyName(company.name);
                    setCompanyLogo(company.logo ?? null);
                }
            } catch (err) {
                console.error(err);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [user, userLoading]);

    const loadQuotes = useCallback(async () => {
        if (userLoading || !user) return;
        try {
            setLoading(true);
            const data = await QuoteService.getQuotes({
                clientId: selectedClientId ? parseInt(selectedClientId) : undefined,
                status: selectedStatus || undefined,
            });
            setQuotes(data);

            if (user.company_id) {
                const company = await CompanyService.getCompany(user.company_id);
                setCompanyName(company.name);
                setCompanyLogo(company.logo ?? null);
            }
        } catch {
            toast.error(dict.quotes?.error_load ?? "Error al cargar presupuestos");
        } finally {
            setLoading(false);
        }
    }, [dict.quotes?.error_load, selectedClientId, selectedStatus, user, userLoading]);

    useEffect(() => {
        startTransition(() => {
            void loadQuotes();
        });
    }, [loadQuotes]);

    const handleDeleteConfirm = async () => {
        const quoteToDeleteId = quoteToDeleteIdRef.current;
        if (!quoteToDeleteId) return;
        try {
            setIsDeleting(true);
            await QuoteService.deleteQuote(quoteToDeleteId);
            toast.success(dict.quotes?.deleted ?? "Presupuesto eliminado");
            setIsDeleteDialogOpen(false);
            quoteToDeleteIdRef.current = null;
            loadQuotes();
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, "Error al eliminar el presupuesto"));
        } finally {
            setIsDeleting(false);
        }
    };

    const handleViewQuote = async (quote: Quote) => {
        try {
            const fresh = await QuoteService.getQuote(quote.id);
            setSelectedQuote(fresh);
        } catch {
            setSelectedQuote(quote);
        }
        setIsDetailOpen(true);
    };

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

    if (userLoading || loading) {
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
        <div className="px-[3%] py-6 md:p-8 h-full overflow-y-auto">
            <PageHeader
                icon={FileText}
                title={dict.quotes?.list_title ?? "Presupuestos"}
                subtitle={dict.quotes?.list_subtitle ?? "Crea y gestiona presupuestos para tus clientes."}
                className="mb-8"
                actions={(
                    <button
                        type="button"
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] hover:bg-[var(--btn-primary-hover-bg)] font-semibold rounded-xl px-5 py-2.5 text-xs flex items-center justify-center gap-2 ui-motion shadow-sm border border-[var(--border-soft)] cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        {dict.quotes?.new_quote ?? "Nuevo Presupuesto"}
                    </button>
                )}
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
                columnLabels={{
                    title: dict.quotes?.col_title ?? "Title",
                    client: dict.quotes?.col_client ?? "Client",
                    date: dict.quotes?.col_date ?? "Date",
                    total: dict.quotes?.col_total ?? "Total",
                    status: dict.quotes?.col_status ?? "Status",
                    actions: dict.quotes?.col_actions ?? "Actions",
                }}
                getClientName={getClientName}
                onViewQuote={handleViewQuote}
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
                onQuoteUpdated={loadQuotes}
                companyName={companyName}
                companyLogo={companyLogo}
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
