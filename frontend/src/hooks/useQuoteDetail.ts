import { startTransition, useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { redirect } from "next/navigation";

import {
    calculateDocumentTaxTotals,
} from "@/lib/billing-calculations";
import { parseBillingInfo } from "@/lib/billing";
import {
    buildQuotePdfTitle,
    printWithDocumentTitle,
} from "@/lib/document-print";
import { createEditableLineKey } from "@/lib/editable-line-key";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { Client, ClientService } from "@/services/client.service";
import { Company, CompanyService } from "@/services/company.service";
import {
    QuoteService,
    type QuoteUpdate,
} from "@/services/quote.service";
import { Quote } from "@/types/quote";


export interface EditingQuoteItem {
    id?: number;
    clientKey: string;
    description: string;
    quantity: number;
    unit_price: number;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    draft: ["sent"],
    sent: ["accepted", "rejected"],
    accepted: [],
    rejected: [],
    expired: [],
};

export function useQuoteDetail(quoteId: number) {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();

    const [quote, setQuote] = useState<Quote | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [showRegisterClientPrompt, setShowRegisterClientPrompt] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editValidUntil, setEditValidUntil] = useState("");
    const [editingItems, setEditingItems] = useState<EditingQuoteItem[]>([]);
    const [deletedItemIds, setDeletedItemIds] = useState<number[]>([]);
    const [editNotes, setEditNotes] = useState("");
    const [editTerms, setEditTerms] = useState("");
    const [editDiscount, setEditDiscount] = useState(0);
    const [editTaxRate, setEditTaxRate] = useState(0.21);
    const [editEquivalenceSurcharge, setEditEquivalenceSurcharge] = useState(0);
    const [editRetention, setEditRetention] = useState(0);
    const [isSavingDraft, setIsSavingDraft] = useState(false);

    if (
        !userLoading
        && (!user || !["admin", "superadmin"].includes(user.role?.name || ""))
    ) {
        redirect("/dashboard");
    }

    const loadAllData = useCallback(async () => {
        if (
            userLoading
            || !user
            || !["admin", "superadmin"].includes(user.role?.name || "")
        ) {
            return;
        }
        try {
            setLoading(true);
            const loadedQuote = await QuoteService.getQuote(quoteId);
            setQuote(loadedQuote);

            const [loadedClient, loadedCompany, loadedClients] = await Promise.all([
                loadedQuote.client_id
                    ? ClientService.getClient(loadedQuote.client_id).catch(() => null)
                    : Promise.resolve(null),
                CompanyService.getCompany(loadedQuote.company_id).catch(() => null),
                ClientService.getClients().catch(() => []),
            ]);
            setClient(loadedClient);
            setCompany(loadedCompany);
            setClients(loadedClients);
        } catch (error) {
            console.error("Error loading quote data", error);
            toast.error(
                dict.quotes?.error_load
                ?? "Error al cargar los datos del presupuesto"
            );
        } finally {
            setLoading(false);
        }
    }, [dict.quotes?.error_load, quoteId, user, userLoading]);

    const loadAllDataEvent = useEffectEvent(() => {
        void loadAllData();
    });

    useEffect(() => {
        if (quoteId) {
            startTransition(() => loadAllDataEvent());
        }
    }, [quoteId]);

    const handleStatusChange = async (
        newStatus: string,
        registerClient = false
    ) => {
        if (!quote) return;
        try {
            setUpdatingStatus(true);
            const updatedFields: QuoteUpdate = { status: newStatus };

            if (
                newStatus === "accepted"
                && quote.client_id === null
                && registerClient
            ) {
                const parsed = parseBillingInfo(quote.custom_recipient_info || "");
                const newClient = await ClientService.createClient({
                    name: parsed.name || quote.title || "Nuevo Cliente",
                    client_type: "individual",
                    legal_number: parsed.taxId || "",
                    address: parsed.address || "",
                    phone: parsed.phone || "",
                    email: parsed.email || "",
                    city: "",
                    postal_code: "",
                    country: "",
                });
                updatedFields.client_id = newClient.id;
                toast.success(
                    `Cliente "${newClient.name}" registrado correctamente`
                );
            }

            await QuoteService.updateQuote(quote.id, updatedFields);
            toast.success(dict.quotes?.status_updated ?? "Estado actualizado");
            await loadAllData();
        } catch (error: unknown) {
            console.error("Error updating quote status", error);
            toast.error(
                getErrorMessage(error, "Error al actualizar el estado")
            );
        } finally {
            setUpdatingStatus(false);
            setShowRegisterClientPrompt(false);
        }
    };

    const getRecipientName = useCallback(() => {
        if (!quote) return "Cliente";
        if (quote.client_id) {
            return (
                clients.find((item) => item.id === quote.client_id)?.name
                || "Cliente"
            );
        }
        return quote.custom_recipient_info?.split("\n")[0] || "Cliente";
    }, [clients, quote]);

    const handlePrint = useCallback(() => {
        if (!quote) return;
        printWithDocumentTitle(
            buildQuotePdfTitle(getRecipientName(), quote.quote_number),
            () => window.print()
        );
    }, [getRecipientName, quote]);

    const handleEnterEditMode = useCallback(() => {
        if (!quote) return;
        setEditTitle(quote.title || "");
        if (quote.valid_until) {
            const date = new Date(quote.valid_until);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            setEditValidUntil(`${year}-${month}-${day}`);
        } else {
            setEditValidUntil("");
        }
        setEditingItems(
            (quote.items || []).map((item) => ({
                id: item.id,
                clientKey: `quote-item-${item.id}`,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
            }))
        );
        setDeletedItemIds([]);
        setEditNotes(quote.notes || "");
        setEditTerms(quote.terms || "");
        setEditDiscount(quote.discount || 0);
        setEditTaxRate(quote.tax_rate ?? 0.21);
        setEditEquivalenceSurcharge(quote.equivalence_surcharge || 0);
        setEditRetention(quote.retention || 0);
        setIsEditMode(true);
    }, [quote]);

    useEffect(() => {
        if (loading || !quote) return;

        const queryParams = new URLSearchParams(window.location.search);
        if (queryParams.get("edit") === "true" && quote.status === "draft") {
            startTransition(handleEnterEditMode);
            window.history.replaceState(null, "", `/dashboard/quotes/${quote.id}`);
        }

        if (queryParams.get("print") === "true") {
            const timer = window.setTimeout(() => {
                handlePrint();
                window.history.replaceState(null, "", `/dashboard/quotes/${quote.id}`);
            }, 800);
            return () => window.clearTimeout(timer);
        }
    }, [
        handleEnterEditMode,
        handlePrint,
        loading,
        quote,
    ]);

    const handleDiscardEdit = () => {
        setIsEditMode(false);
        setEditingItems([]);
        setDeletedItemIds([]);
    };

    const handleAddEditItem = () => {
        setEditingItems((current) => [
            ...current,
            { clientKey: createEditableLineKey("quote-item"), description: "", quantity: 1, unit_price: 0 },
        ]);
    };

    const handleRemoveEditItem = (index: number) => {
        const item = editingItems[index];
        if (item.id) {
            setDeletedItemIds((current) => [...current, item.id as number]);
        }
        setEditingItems((current) =>
            current.filter((_, itemIndex) => itemIndex !== index)
        );
    };

    const handleEditItemChange = (
        index: number,
        field: keyof EditingQuoteItem,
        value: string | number
    ) => {
        setEditingItems((current) =>
            current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: value } : item
            )
        );
    };

    const handleSaveDraft = async () => {
        if (!quote) return;
        try {
            setIsSavingDraft(true);
            await QuoteService.updateQuote(quote.id, {
                title: editTitle,
                valid_until: editValidUntil
                    ? new Date(editValidUntil).toISOString()
                    : null,
                notes: editNotes || null,
                terms: editTerms || null,
                discount: editDiscount,
                tax_rate: editTaxRate,
                equivalence_surcharge: editEquivalenceSurcharge,
                retention: editRetention,
            });

            const itemMutations = editingItems.flatMap((item) => {
                if (item.id) {
                    return [
                        QuoteService.updateQuoteItem(quote.id, item.id, {
                            description: item.description,
                            quantity: item.quantity,
                            unit_price: item.unit_price,
                        }),
                    ];
                }
                return [
                    QuoteService.createQuoteItem(quote.id, {
                        description: item.description,
                        quantity: item.quantity,
                        unit_price: item.unit_price,
                    }),
                ];
            });
            await Promise.all([
                ...deletedItemIds.map((itemId) =>
                    QuoteService.deleteQuoteItem(quote.id, itemId)
                ),
                ...itemMutations,
            ]);

            toast.success(
                dict.quotes?.success_updated
                ?? "Presupuesto actualizado correctamente"
            );
            setIsEditMode(false);
            setEditingItems([]);
            setDeletedItemIds([]);
            await loadAllData();
        } catch (error: unknown) {
            console.error(error);
            toast.error(getErrorMessage(error, "Error al guardar los cambios"));
        } finally {
            setIsSavingDraft(false);
        }
    };

    const editBillingTotals = useMemo(
        () =>
            calculateDocumentTaxTotals(
                editingItems.map((item) => ({
                    quantity: item.quantity,
                    unitPrice: item.unit_price,
                })),
                editTaxRate,
                editDiscount,
                editEquivalenceSurcharge,
                editRetention
            ),
        [
            editDiscount,
            editEquivalenceSurcharge,
            editRetention,
            editTaxRate,
            editingItems,
        ]
    );

    const getClientName = (clientId: number | null) => {
        if (clientId === null) {
            return (
                quote?.custom_recipient_info?.split("\n")[0]
                || dict.quotes?.unregistered_client
                || "No registrado / Nuevo"
            );
        }
        return (
            clients.find((item) => item.id === clientId)?.name
            ?? `Cliente #${clientId}`
        );
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            draft: dict.quotes?.status_draft ?? "Borrador",
            sent: dict.quotes?.status_sent ?? "Enviado",
            accepted: dict.quotes?.status_accepted ?? "Aceptado",
            rejected: dict.quotes?.status_rejected ?? "Rechazado",
            expired: dict.quotes?.status_expired ?? "Vencido",
        };
        return labels[status] ?? status;
    };

    return {
        dict,
        user,
        userLoading,
        quote,
        client,
        company,
        loading,
        updatingStatus,
        showRegisterClientPrompt,
        setShowRegisterClientPrompt,
        isEditMode,
        editTitle,
        setEditTitle,
        editValidUntil,
        setEditValidUntil,
        editingItems,
        editNotes,
        setEditNotes,
        editTerms,
        setEditTerms,
        editDiscount,
        setEditDiscount,
        editTaxRate,
        setEditTaxRate,
        editEquivalenceSurcharge,
        setEditEquivalenceSurcharge,
        editRetention,
        setEditRetention,
        isSavingDraft,
        handleStatusChange,
        handlePrint,
        handleEnterEditMode,
        handleDiscardEdit,
        handleAddEditItem,
        handleRemoveEditItem,
        handleEditItemChange,
        handleSaveDraft,
        editSubtotal: editBillingTotals.subtotal,
        editBaseAmount: editBillingTotals.baseAmount,
        editTaxAmount: editBillingTotals.taxAmount,
        editTotalAmount: editBillingTotals.totalAmount,
        getClientName,
        getStatusLabel,
        nextStates: quote ? ALLOWED_TRANSITIONS[quote.status] || [] : [],
    };
}
