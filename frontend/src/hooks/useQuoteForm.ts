"use client";

import { startTransition, useState, useEffect, useCallback, useEffectEvent } from "react";
import { ClientService, Client } from "@/services/client.service";
import { CompanyService } from "@/services/company.service";
import { QuoteService } from "@/services/quote.service";
import { useDictionary } from "@/lib/dictionary-context";
import { Quote } from "@/types/quote";
import { useUser } from "@/lib/user-context";
import { toast } from "@/lib/toast";
import { BillingPartyFields } from "@/components/billing/BillingPartyCard";
import { calculateDocumentTaxTotals, normalizeTaxRate } from "@/lib/billing-calculations";
import {
    BillingPartyField,
    formatBillingParty,
    parseBillingParty,
    updateBillingPartyField,
} from "@/lib/billing-party";
import { getErrorMessage } from "@/lib/errors";
import { validateDocumentLines } from "@/lib/document-line-validation";
import { duplicateDocumentLine } from "@/lib/document-line-duplication";
import {
    buildQuoteItemsSnapshot,
    buildQuotePayload,
    createQuoteConceptRow,
    DEFAULT_QUOTE_TAX_RATE,
    formatQuoteValidUntilDate,
    getQuoteIssuerFieldsFromCompany,
    getQuoteRecipientFieldsFromClient,
    mapQuoteItemsToConceptRows,
    QuoteFormConceptRow,
} from "@/lib/quote-form";

export type ConceptRow = QuoteFormConceptRow;

interface UseQuoteFormParams {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    clients: Client[];
    onQuoteCreated: () => void;
    quoteToEdit?: Quote | null;
}

export function useQuoteForm({
    open,
    onOpenChange,
    clients: initialClients,
    onQuoteCreated,
    quoteToEdit = null,
}: UseQuoteFormParams) {
    const { dict } = useDictionary();
    const { user } = useUser();
    const [clients, setClients] = useState<Client[]>(initialClients);
    const [selectedClientId, setSelectedClientId] = useState<string>("");
    const [title, setTitle] = useState<string>("");
    const [validUntil, setValidUntil] = useState<string>("");

    const [customIssuerInfo, setCustomIssuerInfo] = useState<string>("");
    const [customRecipientInfo, setCustomRecipientInfo] = useState<string>("");
    const [shippingAddress, setShippingAddress] = useState<string>("");

    const [issuerName, setIssuerName] = useState<string>("");
    const [issuerTaxId, setIssuerTaxId] = useState<string>("");
    const [issuerAddress, setIssuerAddress] = useState<string>("");
    const [issuerPhone, setIssuerPhone] = useState<string>("");
    const [issuerEmail, setIssuerEmail] = useState<string>("");
    const [issuerBank, setIssuerBank] = useState<string>("");
    const [issuerSwiftBic, setIssuerSwiftBic] = useState<string>("");
    const [isEditingIssuer, setIsEditingIssuer] = useState<boolean>(false);

    const [recipientName, setRecipientName] = useState<string>("");
    const [recipientTaxId, setRecipientTaxId] = useState<string>("");
    const [recipientAddress, setRecipientAddress] = useState<string>("");
    const [recipientPhone, setRecipientPhone] = useState<string>("");
    const [recipientEmail, setRecipientEmail] = useState<string>("");
    const [isEditingRecipient, setIsEditingRecipient] = useState<boolean>(false);

    const [concepts, setConcepts] = useState<ConceptRow[]>(() => [
        createQuoteConceptRow(DEFAULT_QUOTE_TAX_RATE, "manual-initial"),
    ]);

    const [discount, setDiscount] = useState<number>(0);
    const [taxRateGlobal, setTaxRateGlobal] = useState<number>(DEFAULT_QUOTE_TAX_RATE);
    const [equivalenceSurcharge, setEquivalenceSurcharge] = useState<number>(0);
    const [retention, setRetention] = useState<number>(0);

    const [notesEnabled, setNotesEnabled] = useState<boolean>(true);
    const [notes, setNotes] = useState<string>(
        () => dict.quotes.notes_placeholder
            || "Términos, condiciones, notas adicionales..."
    );
    const [termsEnabled, setTermsEnabled] = useState<boolean>(true);
    const [terms, setTerms] = useState<string>(
        () => "El presupuesto tiene una validez de 15 días desde la fecha de emisión. Para cualquier consulta, póngase en contacto con nosotros."
    );
    const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

    const [loadingClients, setLoadingClients] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);

    const clearRecipientFields = useCallback(() => {
        setRecipientName("");
        setRecipientTaxId("");
        setRecipientAddress("");
        setRecipientPhone("");
        setRecipientEmail("");
        setCustomRecipientInfo("");
        setShippingAddress("");
    }, []);

    const applyRecipientFromClient = useCallback((client: Client) => {
        const recipient = getQuoteRecipientFieldsFromClient(client);
        setRecipientName(recipient.name);
        setRecipientTaxId(recipient.taxId);
        setRecipientAddress(recipient.address);
        setRecipientPhone(recipient.phone);
        setRecipientEmail(recipient.email);
        setCustomRecipientInfo(formatBillingParty(recipient));
        setShippingAddress("");
    }, []);

    const handleSelectedClientIdChange = useCallback((clientId: string) => {
        setSelectedClientId(clientId);
        if (!clientId) {
            clearRecipientFields();
            return;
        }

        const client = clients.find(c => c.id.toString() === clientId);
        if (client) {
            applyRecipientFromClient(client);
        }
    }, [applyRecipientFromClient, clearRecipientFields, clients]);

    const loadInitialData = useEffectEvent(async () => {
            try {
                setLoadingClients(true);
                const data = await ClientService.getClients(true);
                setClients(data);

                if (quoteToEdit) {
                    setTitle(quoteToEdit.title || "");
                    setSelectedClientId(quoteToEdit.client_id?.toString() || "");
                    setValidUntil(formatQuoteValidUntilDate(quoteToEdit.valid_until));
                    
                    setDiscount(quoteToEdit.discount || 0);
                    setTaxRateGlobal(quoteToEdit.tax_rate || DEFAULT_QUOTE_TAX_RATE);
                    setEquivalenceSurcharge(quoteToEdit.equivalence_surcharge || 0);
                    setRetention(quoteToEdit.retention || 0);
                    
                    setNotesEnabled(quoteToEdit.notes !== null);
                    setNotes(quoteToEdit.notes || "");
                    
                    setTermsEnabled(quoteToEdit.terms !== null);
                    setTerms(quoteToEdit.terms || "");
                    
                    setSignatureUrl(quoteToEdit.signature_url || null);
                    
                    setCustomIssuerInfo(quoteToEdit.custom_issuer_info || "");
                    setCustomRecipientInfo(quoteToEdit.custom_recipient_info || "");
                    setShippingAddress(quoteToEdit.shipping_address || "");

                    if (quoteToEdit.custom_issuer_info) {
                        const parsed = parseBillingParty(quoteToEdit.custom_issuer_info);
                        setIssuerName(parsed.name);
                        setIssuerTaxId(parsed.taxId);
                        setIssuerAddress(parsed.address);
                        setIssuerPhone(parsed.phone);
                        setIssuerEmail(parsed.email);
                        setIssuerBank(parsed.bank || "");
                        setIssuerSwiftBic(parsed.swiftBic || "");

                    }
                    if (quoteToEdit.custom_recipient_info) {
                        const parsed = parseBillingParty(quoteToEdit.custom_recipient_info);
                        setRecipientName(parsed.name);
                        setRecipientTaxId(parsed.taxId);
                        setRecipientAddress(parsed.address);
                        setRecipientPhone(parsed.phone);
                        setRecipientEmail(parsed.email);

                    } else if (quoteToEdit.client_id) {
                        const quoteClient = data.find(c => c.id === quoteToEdit.client_id);
                        if (quoteClient) {
                            applyRecipientFromClient(quoteClient);
                        }
                    }

                    setConcepts(mapQuoteItemsToConceptRows(quoteToEdit));
                } else {
                    if (user?.company_id) {
                        const comp = await CompanyService.getCompany(user.company_id);
                        const issuer = getQuoteIssuerFieldsFromCompany(comp);

                        setIssuerName(issuer.name);
                        setIssuerTaxId(issuer.taxId);
                        setIssuerAddress(issuer.address);
                        setIssuerPhone(issuer.phone);
                        setIssuerEmail(issuer.email);
                        setIssuerBank(issuer.bank || "");
                        setIssuerSwiftBic(issuer.swiftBic || "");
                        setNotes(
                            comp.default_payment_notes
                            || dict.quotes.notes_placeholder
                            || ""
                        );
                        setTerms(
                            comp.default_document_terms
                            || dict.quotes.terms_placeholder
                            || ""
                        );
                        setCustomIssuerInfo(formatBillingParty(issuer));
                    }
                }
            } catch (error) {
                console.error("Error loading initial data", error);
                toast.error(dict.quotes?.error_load || "Error al cargar datos");
            } finally {
                setLoadingClients(false);
            }
    });

    useEffect(() => {
        if (!open) return;
        startTransition(() => {
            void loadInitialData();
        });
    }, [open, quoteToEdit]);

    const handleAddManualRow = () => {
        setConcepts(prev => [...prev, createQuoteConceptRow(taxRateGlobal)]);
    };

    const handleDuplicateRow = (id: string) => {
        setConcepts((previous) => duplicateDocumentLine(previous, id, (source) => ({
            ...source,
            id: `manual-copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        })));
    };

    const handleUpdateRow = <Field extends keyof ConceptRow>(
        id: string,
        field: Field,
        value: ConceptRow[Field]
    ) => {
        setConcepts(prev => prev.map(row => {
            if (row.id === id) {
                return { ...row, [field]: value };
            }
            return row;
        }));
    };

    const handleDeleteRow = (id: string) => {
        setConcepts(prev => prev.filter(c => c.id !== id));
    };

    const handleGlobalTaxRateChange = (newRate: number) => {
        const normalizedRate = normalizeTaxRate(newRate);
        setTaxRateGlobal(normalizedRate);
        setConcepts(prev => prev.map(row => ({ ...row, taxRate: normalizedRate })));
    };

    const billingTotals = calculateDocumentTaxTotals(
        concepts.map((concept) => ({
            quantity: concept.quantity,
            unitPrice: concept.unitPrice,
        })),
        taxRateGlobal,
        discount,
        equivalenceSurcharge,
        retention,
    );
    const {
        subtotal,
        discountAmount,
        baseAmount,
        taxAmount,
        surchargeAmount,
        retentionAmount,
        totalAmount: totalGeneral,
    } = billingTotals;

    const handleCreateQuote = async (e: React.FormEvent) => {
        e.preventDefault();
        const lineError = validateDocumentLines(
            concepts.map((concept) => ({
                description: concept.description,
                quantity: concept.quantity,
                unitPrice: concept.unitPrice,
            }))
        );
        if (lineError) {
            const messages = {
                empty: "Añade al menos una línea al presupuesto.",
                description: "Completa la descripción de todas las líneas.",
                quantity: "La cantidad de cada línea debe ser mayor que cero.",
                "unit-price": "El precio de una línea no puede ser negativo.",
            };
            toast.error(
                lineError === "description"
                    ? dict.quotes?.error_items || messages.description
                    : messages[lineError]
            );
            return;
        }

        try {
            setSubmitting(true);
            const quotePayload = buildQuotePayload({
                selectedClientId,
                title,
                validUntil,
                notesEnabled,
                notes,
                taxRateGlobal,
                discount,
                equivalenceSurcharge,
                retention,
                termsEnabled,
                terms,
                shippingAddress,
                customIssuerInfo,
                customRecipientInfo,
                signatureUrl,
            });
            const quoteSnapshot = {
                ...quotePayload,
                items: buildQuoteItemsSnapshot(concepts),
            };

            if (quoteToEdit) {
                await QuoteService.updateQuote(quoteToEdit.id, quoteSnapshot);

                toast.success(dict.quotes?.success_updated || "Presupuesto actualizado correctamente");
                onQuoteCreated();
                handleClose();
            } else {
                await QuoteService.createQuote(quoteSnapshot);

                toast.success(dict.quotes?.success_created || "Presupuesto creado correctamente");
                onQuoteCreated();
                handleClose();
            }
        } catch (error: unknown) {
            console.error("Error saving quote", error);
            toast.error(getErrorMessage(
                error,
                dict.quotes?.error_create || "Error al guardar el presupuesto"
            ));
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setTitle("");
        setSelectedClientId("");
        setValidUntil("");
        setDiscount(0);
        setTaxRateGlobal(DEFAULT_QUOTE_TAX_RATE);
        setEquivalenceSurcharge(0);
        setRetention(0);
        setNotes("");
        setTerms("");
        setSignatureUrl(null);
        setCustomIssuerInfo("");
        clearRecipientFields();
        setIsEditingIssuer(false);
        setIsEditingRecipient(false);
        setConcepts([createQuoteConceptRow(DEFAULT_QUOTE_TAX_RATE)]);
        onOpenChange(false);
    };

    const handleUpdateIssuerField = (field: BillingPartyField, value: string) => {
        const updatedFields = updateBillingPartyField(issuerFields, field, value);
        setIssuerName(updatedFields.name);
        setIssuerTaxId(updatedFields.taxId);
        setIssuerAddress(updatedFields.address);
        setIssuerPhone(updatedFields.phone);
        setIssuerEmail(updatedFields.email);
        setIssuerBank(updatedFields.bank || "");
        setIssuerSwiftBic(updatedFields.swiftBic || "");
        setCustomIssuerInfo(formatBillingParty(updatedFields));
    };

    const handleUpdateRecipientField = (field: BillingPartyField, value: string) => {
        const updatedFields = updateBillingPartyField(recipientFields, field, value);
        setRecipientName(updatedFields.name);
        setRecipientTaxId(updatedFields.taxId);
        setRecipientAddress(updatedFields.address);
        setRecipientPhone(updatedFields.phone);
        setRecipientEmail(updatedFields.email);
        setCustomRecipientInfo(formatBillingParty(updatedFields));
    };

    const issuerFields: BillingPartyFields = {
        name: issuerName,
        taxId: issuerTaxId,
        address: issuerAddress,
        phone: issuerPhone,
        email: issuerEmail,
        bank: issuerBank,
        swiftBic: issuerSwiftBic,
    };

    const recipientFields: BillingPartyFields = {
        name: recipientName,
        taxId: recipientTaxId,
        address: recipientAddress,
        phone: recipientPhone,
        email: recipientEmail,
    };

    return {
        dict,
        user,
        clients,
        selectedClientId,
        setSelectedClientId: handleSelectedClientIdChange,
        title,
        setTitle,
        validUntil,
        setValidUntil,
        customIssuerInfo,
        setCustomIssuerInfo,
        customRecipientInfo,
        setCustomRecipientInfo,
        shippingAddress,
        setShippingAddress,
        concepts,
        discount,
        setDiscount,
        taxRateGlobal,
        setTaxRateGlobal,
        equivalenceSurcharge,
        setEquivalenceSurcharge,
        retention,
        setRetention,
        notesEnabled,
        setNotesEnabled,
        notes,
        setNotes,
        termsEnabled,
        setTermsEnabled,
        terms,
        setTerms,
        signatureUrl,
        setSignatureUrl,
        loadingClients,
        submitting,
        handleAddManualRow,
        handleDuplicateRow,
        handleUpdateRow,
        handleDeleteRow,
        handleGlobalTaxRateChange,
        subtotal,
        discountAmount,
        baseAmount,
        taxAmount,
        surchargeAmount,
        retentionAmount,
        totalGeneral,
        handleCreateQuote,
        handleClose,
        handleUpdateIssuerField,
        handleUpdateRecipientField,
        parseBillingInfo: parseBillingParty,
        issuerFields,
        recipientFields,
        isEditingIssuer,
        setIsEditingIssuer,
        isEditingRecipient,
        setIsEditingRecipient,
    };
}
