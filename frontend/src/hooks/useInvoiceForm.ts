"use client";

import { startTransition, useState, useEffect, useRef, useCallback, useEffectEvent, useMemo } from "react";
import { ClientService, Client } from "@/services/client.service";
import { TaskItem } from "@/services/task.service";
import { InvoiceService, InvoiceableTask } from "@/services/invoice.service";
import { CompanyService } from "@/services/company.service";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { toast } from "@/lib/toast";
import { BillingPartyFields } from "@/components/billing/BillingPartyCard";
import { calculatePerLineTaxTotals, normalizeTaxRate } from "@/lib/billing-calculations";
import {
    BillingPartyField,
    formatBillingParty,
    parseBillingParty,
    updateBillingPartyField,
} from "@/lib/billing-party";
import { getErrorMessage } from "@/lib/errors";
import {
    buildInvoiceTaskConcepts,
    prepareInvoiceTasks,
} from "@/lib/invoice-task-selection";
import { validateDocumentLines } from "@/lib/document-line-validation";
import {
    buildInvoiceDraftPayload,
    createInvoiceConceptRow,
    DEFAULT_INVOICE_TAX_RATE,
    forceInvoiceTasksClientId,
    getDefaultInvoiceDueDate,
    getIssuerFieldsFromCompany,
    getRecipientFieldsFromClient,
    getTodayIsoDate,
    InvoiceFormConceptRow,
    resolveInvoiceClientId,
} from "@/lib/invoice-form";

export type ConceptRow = InvoiceFormConceptRow;

interface UseInvoiceFormParams {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onInvoiceCreated: () => void;
    initialClientId?: string;
    initialTaskIds?: number[];
    initialTasks?: InvoiceableTask[];
}

const EMPTY_TASK_IDS: number[] = [];
const EMPTY_TASKS: InvoiceableTask[] = [];

export function useInvoiceForm({
    open,
    onOpenChange,
    onInvoiceCreated,
    initialClientId,
    initialTaskIds = EMPTY_TASK_IDS,
    initialTasks = EMPTY_TASKS,
}: UseInvoiceFormParams) {
    const { dict } = useDictionary();
    const { user } = useUser();
    const initialTaskIdKey = initialTaskIds.join(",");
    const initialTaskClientId =
        initialTasks[0]?.client_id?.toString();
    const hasInitialTasks = initialTaskIds.length > 0;
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<string>(
        () => initialTaskClientId || initialClientId || ""
    );
    const [issueDate, setIssueDateValue] = useState<string>(getTodayIsoDate);
    const [dueDate, setDueDate] = useState<string>(() => getDefaultInvoiceDueDate());
    const [invoiceNumber, setInvoiceNumber] = useState<string>("");

    const [customIssuerInfo, setCustomIssuerInfo] = useState<string>("");
    const [customRecipientInfo, setCustomRecipientInfo] = useState<string>("");
    const [shippingAddress, setShippingAddress] = useState<string>("");

    const [issuerName, setIssuerName] = useState<string>("");
    const [issuerTaxId, setIssuerTaxId] = useState<string>("");
    const [issuerAddress, setIssuerAddress] = useState<string>("");
    const [issuerPhone, setIssuerPhone] = useState<string>("");
    const [issuerEmail, setIssuerEmail] = useState<string>("");
    const [issuerBank, setIssuerBank] = useState<string>("");
    const [isEditingIssuer, setIsEditingIssuer] = useState<boolean>(false);

    const [recipientName, setRecipientName] = useState<string>("");
    const [recipientTaxId, setRecipientTaxId] = useState<string>("");
    const [recipientAddress, setRecipientAddress] = useState<string>("");
    const [recipientPhone, setRecipientPhone] = useState<string>("");
    const [recipientEmail, setRecipientEmail] = useState<string>("");
    const [isEditingRecipient, setIsEditingRecipient] = useState<boolean>(false);

    const [concepts, setConcepts] = useState<ConceptRow[]>([]);

    const [discount, setDiscount] = useState<number>(0);
    const [taxRateGlobal, setTaxRateGlobal] = useState<number>(DEFAULT_INVOICE_TAX_RATE);
    const taxRateGlobalRef = useRef(DEFAULT_INVOICE_TAX_RATE);
    const [equivalenceSurcharge, setEquivalenceSurcharge] = useState<number>(0);
    const [retention, setRetention] = useState<number>(0);

    const [notesEnabled, setNotesEnabled] = useState<boolean>(true);
    const [notes, setNotes] = useState<string>(
        () => dict.invoices.payment_notes_placeholder
            || "Instrucciones de pago: Por favor realice el pago a los siguientes datos: Nombre: Banco: Número de cuenta: Código IBAN o SWIFT: Declaración: Todos los datos anteriores son verdaderos"
    );
    const [termsEnabled, setTermsEnabled] = useState<boolean>(true);
    const [terms, setTerms] = useState<string>(
        () => dict.invoices.terms_conditions_placeholder
            || "El pago se debe realizar en un plazo de 8-10 días desde la fecha de la factura. Si tiene alguna duda, por favor contáctenos por email. ¡Gracias por su confianza!"
    );
    const [signatureUrl, setSignatureUrl] = useState<string | null>(null);

    const [loadingClients, setLoadingClients] = useState<boolean>(false);
    const [loadingTasks, setLoadingTasks] = useState<boolean>(false);
    const [submitting, setSubmitting] = useState<boolean>(false);

    const [invoiceableJobs, setInvoiceableJobs] = useState<InvoiceableTask[]>([]);
    const [selectedTaskIds, setSelectedTaskIds] = useState<number[]>([]);

    const availableTasks = useMemo(
        () => prepareInvoiceTasks({
            fetchedTasks: invoiceableJobs,
            initialTasks,
            initialTaskIds,
            selectedClientId,
        }).availableTasks,
        [invoiceableJobs, initialTasks, initialTaskIds, selectedClientId],
    );

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
        const recipient = getRecipientFieldsFromClient(client);
        setRecipientName(recipient.name);
        setRecipientTaxId(recipient.taxId);
        setRecipientAddress(recipient.address);
        setRecipientPhone(recipient.phone);
        setRecipientEmail(recipient.email);
        setCustomRecipientInfo(formatBillingParty(recipient));
        setShippingAddress("");
    }, []);

    const applyTaskSelectionForClient = useCallback((clientId: string, jobs: InvoiceableTask[]) => {
        if (!clientId) {
            setSelectedTaskIds([]);
            setConcepts((prev) => prev.filter((c) => !c.task_item_id));
            return;
        }

        const prepared = prepareInvoiceTasks({
            fetchedTasks: jobs,
            initialTasks,
            initialTaskIds,
            selectedClientId: clientId,
        });
        setSelectedTaskIds(prepared.selectedTaskIds);
        setConcepts(
            buildInvoiceTaskConcepts(
                prepared.availableTasks,
                prepared.selectedTaskIds,
                taxRateGlobalRef.current,
            ),
        );
    }, [initialTaskIds, initialTasks]);

    const handleSelectedClientIdChange = useCallback((clientId: string) => {
        setSelectedClientId(clientId);
        if (!clientId) {
            clearRecipientFields();
            applyTaskSelectionForClient("", invoiceableJobs);
            return;
        }

        const client = clients.find(c => c.id.toString() === clientId);
        if (client) {
            applyRecipientFromClient(client);
        }
        applyTaskSelectionForClient(clientId, invoiceableJobs);
    }, [
        applyRecipientFromClient,
        applyTaskSelectionForClient,
        clearRecipientFields,
        clients,
        invoiceableJobs,
    ]);

    const setIssueDate = (value: string) => {
        setIssueDateValue(value);
        const nextDueDate = getDefaultInvoiceDueDate(value);
        if (nextDueDate) setDueDate(nextDueDate);
    };

    const maxDueDate = getDefaultInvoiceDueDate(issueDate);

    const loadInitialData = useEffectEvent(async () => {
            try {
                setLoadingClients(true);
                setLoadingTasks(true);
                // When the form comes from Completed Jobs, those selected rows
                // are already the source of truth. Avoid a second request that
                // can fail or race with the modal state.
                const completedJobs = hasInitialTasks
                    ? initialTasks
                    : await InvoiceService.getCompletedJobs();
                const data = await ClientService.getClients(true);
                const requestedClientId = resolveInvoiceClientId({
                    clients: data,
                    initialTasks,
                    initialClientId,
                });
                const normalizedInitialTasks = forceInvoiceTasksClientId(
                    initialTasks,
                    requestedClientId,
                );
                const allJobs = hasInitialTasks
                    ? normalizedInitialTasks
                    : completedJobs;
                setInvoiceableJobs(allJobs);
                setClients(data);
                if (requestedClientId) {
                    setSelectedClientId(requestedClientId);
                    const requestedClient = data.find(c => c.id.toString() === requestedClientId);
                    if (requestedClient) {
                        applyRecipientFromClient(requestedClient);
                    }
                    const prepared = prepareInvoiceTasks({
                        fetchedTasks: allJobs,
                        initialTasks: normalizedInitialTasks,
                        initialTaskIds,
                        selectedClientId: requestedClientId,
                    });
                    setSelectedTaskIds(prepared.selectedTaskIds);
                    setConcepts(
                        buildInvoiceTaskConcepts(
                            prepared.availableTasks,
                            prepared.selectedTaskIds,
                            taxRateGlobalRef.current,
                        ),
                    );
                } else {
                    setSelectedClientId("");
                    clearRecipientFields();
                    setSelectedTaskIds([]);
                    setConcepts((prev) => prev.filter((c) => !c.task_item_id));
                }

                if (user?.company_id) {
                    const comp = await CompanyService.getCompany(user.company_id);
                    const issuer = getIssuerFieldsFromCompany(comp);

                    setIssuerName(issuer.name);
                    setIssuerTaxId(issuer.taxId);
                    setIssuerAddress(issuer.address);
                    setIssuerPhone(issuer.phone);
                    setIssuerEmail(issuer.email);
                    setIssuerBank(issuer.bank || "");
                    setNotes(
                        comp.default_payment_notes
                        || dict.invoices.payment_notes_placeholder
                        || ""
                    );
                    setTerms(
                        comp.default_document_terms
                        || dict.invoices.terms_conditions_placeholder
                        || ""
                    );
                    setCustomIssuerInfo(formatBillingParty(issuer));
                }
            } catch (error) {
                console.error("Error loading initial data", error);
                toast.error(dict.invoices.error_load);
            } finally {
                setLoadingClients(false);
                setLoadingTasks(false);
            }
    });

    useEffect(() => {
        if (!open) return;
        startTransition(() => {
            void loadInitialData();
        });
    }, [open, initialClientId, initialTaskClientId, initialTaskIdKey, hasInitialTasks]);

    const handleToggleTask = (task: TaskItem & { locationName: string }) => {
        const isChecked = selectedTaskIds.includes(task.id);
        if (isChecked) {
            setSelectedTaskIds(prev => prev.filter(id => id !== task.id));
            setConcepts(prev => prev.filter(c => c.task_item_id !== task.id));
        } else {
            setSelectedTaskIds(prev => [...prev, task.id]);
            const [newConcept] = buildInvoiceTaskConcepts(
                [task as InvoiceableTask & { locationName: string }],
                [task.id],
                taxRateGlobal,
            );
            if (newConcept) {
                setConcepts(prev => [...prev, newConcept]);
            }
        }
    };

    const handleToggleAll = () => {
        if (selectedTaskIds.length === availableTasks.length) {
            setSelectedTaskIds([]);
            setConcepts(prev => prev.filter(c => !c.task_item_id));
        } else {
            const allIds = availableTasks.map(t => t.id);
            setSelectedTaskIds(allIds);
            
            const manualConcepts = concepts.filter(c => !c.task_item_id);
            const taskConcepts = buildInvoiceTaskConcepts(
                availableTasks as (InvoiceableTask & { locationName: string })[],
                allIds,
                taxRateGlobal,
            );
            setConcepts([...manualConcepts, ...taskConcepts]);
        }
    };

    const handleAddManualRow = () => {
        setConcepts(prev => [...prev, createInvoiceConceptRow(taxRateGlobal)]);
    };

    const handleAddExternalLaundryRow = () => {
        setConcepts(prev => [
            ...prev,
            createInvoiceConceptRow(taxRateGlobal, "external-laundry"),
        ]);
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
        const row = concepts.find(c => c.id === id);
        if (row?.task_item_id) {
            setSelectedTaskIds(prev => prev.filter(tid => tid !== row.task_item_id));
        }
        setConcepts(prev => prev.filter(c => c.id !== id));
    };

    const handleGlobalTaxRateChange = (newRate: number) => {
        const normalizedRate = normalizeTaxRate(newRate);
        taxRateGlobalRef.current = normalizedRate;
        setTaxRateGlobal(normalizedRate);
        setConcepts(prev => prev.map(row => ({ ...row, taxRate: normalizedRate })));
    };

    const billingTotals = calculatePerLineTaxTotals(
        concepts.map((concept) => ({
            quantity: concept.quantity,
            unitPrice: concept.unitPrice,
            taxRate: concept.taxRate,
        })),
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

    const handleCreateInvoice = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientId) {
            toast.error(dict.invoices.client_select);
            return;
        }
        const lineError = validateDocumentLines(
            concepts.map((concept) => ({
                description: concept.description,
                quantity: concept.quantity,
                unitPrice: concept.unitPrice,
            }))
        );
        if (lineError) {
            const messages = {
                empty: "Debe añadir al menos un concepto en la factura.",
                description: "Completa la descripción de todos los conceptos.",
                quantity: "La cantidad de cada concepto debe ser mayor que cero.",
                "unit-price": "El precio de un concepto no puede ser negativo.",
            };
            toast.error(messages[lineError]);
            return;
        }
        try {
            setSubmitting(true);

            await InvoiceService.createInvoiceDraft(buildInvoiceDraftPayload({
                selectedClientId,
                issueDate,
                dueDate,
                invoiceNumber,
                discount,
                equivalenceSurcharge,
                retention,
                notesEnabled,
                notes,
                termsEnabled,
                terms,
                shippingAddress,
                customIssuerInfo,
                customRecipientInfo,
                signatureUrl,
                concepts,
            }));

            toast.success(dict.invoices.success_create);
            onInvoiceCreated();
            onOpenChange(false);
        } catch (error: unknown) {
            console.error("Error creating invoice", error);
            toast.error(getErrorMessage(error, dict.invoices.error_create));
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdateIssuerField = (field: BillingPartyField, value: string) => {
        const updatedFields = updateBillingPartyField(issuerFields, field, value);
        setIssuerName(updatedFields.name);
        setIssuerTaxId(updatedFields.taxId);
        setIssuerAddress(updatedFields.address);
        setIssuerPhone(updatedFields.phone);
        setIssuerEmail(updatedFields.email);
        setIssuerBank(updatedFields.bank || "");
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
        isClientLocked: hasInitialTasks,
        issueDate,
        setIssueDate,
        dueDate,
        setDueDate,
        invoiceNumber,
        setInvoiceNumber,
        maxDueDate,
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
        loadingTasks,
        submitting,
        availableTasks,
        selectedTaskIds,
        handleToggleTask,
        handleToggleAll,
        handleAddManualRow,
        handleAddExternalLaundryRow,
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
        handleCreateInvoice,
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
