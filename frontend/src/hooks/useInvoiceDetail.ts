import { startTransition, useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { redirect } from "next/navigation";

import {
    calculatePerLineTaxTotals,
    priceExcludingTax,
    priceForTaxMode,
} from "@/lib/billing-calculations";
import {
    BillingPartyField,
    BillingPartyFields,
    formatBillingParty,
    parseBillingParty,
    updateBillingPartyField,
} from "@/lib/billing-party";
import {
    buildInvoicePdfTitle,
    printWithDocumentTitle,
} from "@/lib/document-print";
import { validateDocumentLines } from "@/lib/document-line-validation";
import { createEditableLineKey } from "@/lib/editable-line-key";
import { useDictionary } from "@/lib/dictionary-context";
import { getErrorMessage } from "@/lib/errors";
import { formatDateLong } from "@/lib/format";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { Client, ClientService } from "@/services/client.service";
import { Company, CompanyService } from "@/services/company.service";
import {
    FacturaeReadiness,
    FiscalInvoiceRecord,
    FiscalReadiness,
    InvoiceEmailPayload,
    InvoiceService,
} from "@/services/invoice.service";
import { Invoice, type InvoicePaymentMethod } from "@/types/invoice";


export interface EditingInvoiceItem {
    id?: number;
    clientKey: string;
    description: string;
    quantity: number;
    unit_price: number;
    tax_rate: number;
    task_item_id?: number | null;
}

const EMPTY_BILLING_PARTY_FIELDS: BillingPartyFields = {
    name: "",
    taxId: "",
    address: "",
    postalCode: "",
    city: "",
    province: "",
    country: "",
    phone: "",
    email: "",
    bank: "",
    swiftBic: "",
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    draft: ["issued", "cancelled"],
    issued: ["paid", "overdue"],
    paid: [],
    cancelled: [],
    overdue: ["paid"],
    rectified: [],
};

const missingValue = (value: unknown) => {
    const normalized = String(value ?? "").trim();
    return !normalized || normalized === "-" || /^no informado$/i.test(normalized);
};

const hasTaxId = (value: unknown) => !missingValue(value);

function getIssueBlocker(invoice: Invoice, client: Client | null, company: Company | null): string | null {
    const customIssuer = invoice.custom_issuer_info
        ? parseBillingParty(invoice.custom_issuer_info)
        : null;
    const customRecipient = invoice.custom_recipient_info
        ? parseBillingParty(invoice.custom_recipient_info)
        : null;

    const missing: string[] = [];
    if (missingValue(customIssuer?.name || company?.name)) {
        missing.push("nombre del emisor");
    }
    if (missingValue(customIssuer?.taxId || company?.tax_id)) {
        missing.push("NIF/CIF del emisor");
    }
    if (missingValue(customIssuer?.address || company?.address)) {
        missing.push("dirección fiscal del emisor");
    }
    if (missingValue(customRecipient?.name || client?.name)) {
        missing.push("nombre del destinatario");
    }
    if (missingValue(customRecipient?.address || client?.address)) {
        missing.push("dirección fiscal del destinatario");
    }
    if (!invoice.items?.length) {
        missing.push("al menos una línea de factura");
    }

    return missing.length
        ? `No puedes emitir la factura. Falta: ${missing.join(", ")}.`
        : null;
}

function toDateInputValue(value: string | null | undefined): string {
    if (!value) return "";
    return value.substring(0, 10);
}

function editableIssuerFields(invoice: Invoice, company: Company | null): BillingPartyFields {
    if (invoice.custom_issuer_info) {
        return parseBillingParty(invoice.custom_issuer_info);
    }
    const snapshot = invoice.issuer_snapshot || {};
    return {
        name: String(snapshot.name || company?.name || ""),
        taxId: String(snapshot.tax_id || company?.tax_id || ""),
        address: String(snapshot.address || company?.address || ""),
        postalCode: String(snapshot.postal_code || ""),
        city: String(snapshot.city || ""),
        province: String(snapshot.province || ""),
        country: String(snapshot.country || ""),
        phone: String(snapshot.phone || company?.phone || ""),
        email: String(snapshot.email || company?.email || ""),
        bank: String(snapshot.bank_account || company?.bank_account || ""),
        swiftBic: String(snapshot.swift_bic || company?.swift_bic || ""),
    };
}

function editableRecipientFields(invoice: Invoice, client: Client | null): BillingPartyFields {
    if (invoice.custom_recipient_info) {
        return parseBillingParty(invoice.custom_recipient_info);
    }
    const snapshot = invoice.recipient_snapshot || {};
    return {
        name: String(snapshot.name || client?.name || ""),
        taxId: String(snapshot.tax_id || client?.legal_number || ""),
        address: String(snapshot.address || client?.address || ""),
        postalCode: String(snapshot.postal_code || client?.postal_code || ""),
        city: String(snapshot.city || client?.city || ""),
        province: String(snapshot.province || client?.province || ""),
        country: String(snapshot.country || client?.country || ""),
        phone: String(snapshot.phone || client?.phone || ""),
        email: String(snapshot.email || client?.email || ""),
    };
}

function translateIssueError(message: string): string {
    const labels: Record<string, string> = {
        "issuer name": "nombre del emisor",
        "issuer tax ID": "NIF/CIF del emisor",
        "issuer address": "dirección fiscal del emisor",
        "recipient name": "nombre del destinatario",
        "recipient tax ID": "NIF/CIF del destinatario",
        "recipient address": "dirección fiscal del destinatario",
        "at least one invoice line": "al menos una línea de factura",
        "software producer tax ID": "NIF/CIF del productor del software",
    };

    if (message.startsWith("Cannot issue invoice. Invalid:")) {
        const invalid = message
            .replace("Cannot issue invoice. Invalid:", "")
            .split(",")
            .flatMap((field) => {
                const result = labels[field.trim()] || field.trim();
                return result ? [result] : [];
            });
        return `No puedes emitir la factura. Revisa: ${invalid.join(", ")}.`;
    }

    if (!message.startsWith("Cannot issue invoice. Missing:")) {
        return message;
    }
    const missing = message
        .replace("Cannot issue invoice. Missing:", "")
        .split(",")
        .flatMap((field) => {
            const result = labels[field.trim()] || field.trim();
            return result ? [result] : [];
        });
    return `No puedes emitir la factura. Falta: ${missing.join(", ")}.`;
}

export function useInvoiceDetail(invoiceId: number) {
    const { dict, locale } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const [invoice, setInvoice] = useState<Invoice | null>(null);
    const [client, setClient] = useState<Client | null>(null);
    const [company, setCompany] = useState<Company | null>(null);
    const [loading, setLoading] = useState(true);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [isRectificationOpen, setIsRectificationOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingInvoiceNumber, setEditingInvoiceNumber] = useState("");
    const [editingIssueDate, setEditingIssueDate] = useState("");
    const [editingDueDate, setEditingDueDate] = useState("");
    const [editingPaymentMethod, setEditingPaymentMethod] = useState<InvoicePaymentMethod>("bank_transfer");
    const [editingPricesIncludeTax, setEditingPricesIncludeTax] = useState(false);
    const [editingIssuerFields, setEditingIssuerFields] = useState<BillingPartyFields>(
        EMPTY_BILLING_PARTY_FIELDS
    );
    const [editingRecipientFields, setEditingRecipientFields] = useState<BillingPartyFields>(
        EMPTY_BILLING_PARTY_FIELDS
    );
    const [editingItems, setEditingItems] = useState<EditingInvoiceItem[]>([]);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [fiscalRecord, setFiscalRecord] = useState<FiscalInvoiceRecord | null>(null);
    const [fiscalReadiness, setFiscalReadiness] = useState<FiscalReadiness | null>(null);
    const [facturaeReadiness, setFacturaeReadiness] = useState<FacturaeReadiness | null>(null);
    const [isSubmittingFiscal, setIsSubmittingFiscal] = useState(false);
    const [isGeneratingFacturae, setIsGeneratingFacturae] = useState(false);

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
            const loadedInvoice = await InvoiceService.getInvoice(invoiceId);
            setInvoice(loadedInvoice);
            const isIssued = ["issued", "paid", "overdue", "rectified"].includes(
                loadedInvoice.status
            );
            const [
                loadedClient,
                loadedCompany,
                loadedFiscalRecord,
                loadedFiscalReadiness,
                loadedFacturaeReadiness,
            ] = await Promise.all([
                ClientService.getClient(loadedInvoice.client_id).catch(() => null),
                CompanyService.getCompany(loadedInvoice.company_id).catch(() => null),
                isIssued
                    ? InvoiceService.getFiscalRecord(loadedInvoice.id).catch(() => null)
                    : Promise.resolve(null),
                isIssued
                    ? InvoiceService.getFiscalReadiness().catch(() => null)
                    : Promise.resolve(null),
                isIssued
                    ? InvoiceService.getFacturaeReadiness(loadedInvoice.id).catch(() => null)
                    : Promise.resolve(null),
            ]);
            setClient(loadedClient);
            setCompany(loadedCompany);
            setFiscalRecord(loadedFiscalRecord);
            setFiscalReadiness(loadedFiscalReadiness);
            setFacturaeReadiness(loadedFacturaeReadiness);
        } catch (error) {
            console.error("Error loading invoice data", error);
            toast.error(dict.invoices.error_load);
        } finally {
            setLoading(false);
        }
    }, [dict.invoices.error_load, invoiceId, user, userLoading]);

    const loadAllDataEvent = useEffectEvent(() => {
        void loadAllData();
    });

    useEffect(() => {
        if (invoiceId) {
            startTransition(() => loadAllDataEvent());
        }
    }, [invoiceId]);

    const getRecipientName = useCallback(() => {
        if (client?.name) return client.name;
        return invoice?.custom_recipient_info?.split("\n")[0] || "Cliente";
    }, [client, invoice]);

    const handlePrint = useCallback(() => {
        if (!invoice) return;
        printWithDocumentTitle(
            buildInvoicePdfTitle(getRecipientName(), invoice.invoice_number),
            () => window.print()
        );
    }, [getRecipientName, invoice]);

    const handlePdfAction = useCallback(async () => {
        if (!invoice) return;
        if (!["issued", "paid", "overdue", "rectified"].includes(invoice.status)) {
            handlePrint();
            return;
        }
        try {
            setIsDownloadingPdf(true);
            await InvoiceService.downloadInvoicePdf(
                invoice.id,
                invoice.invoice_number
            );
        } catch (error: unknown) {
            console.error("Error downloading invoice PDF", error);
            toast.error(
                getErrorMessage(error, dict.invoices.error_download_pdf)
            );
        } finally {
            setIsDownloadingPdf(false);
        }
    }, [dict.invoices.error_download_pdf, handlePrint, invoice]);

    const handleSendEmail = useCallback(async (emailData: InvoiceEmailPayload) => {
        if (!invoice) return false;
        try {
            setIsSendingEmail(true);
            const result = await InvoiceService.sendInvoiceEmail(
                invoice.id,
                emailData
            );
            toast.success(
                `${dict.invoices.success_send_email}: ${result.recipient_email}`
            );
            return true;
        } catch (error: unknown) {
            console.error("Error sending invoice email", error);
            toast.error(
                getErrorMessage(error, dict.invoices.error_send_email)
            );
            return false;
        } finally {
            setIsSendingEmail(false);
        }
    }, [
        dict.invoices.error_send_email,
        dict.invoices.success_send_email,
        invoice,
    ]);

    const handleSubmitFiscal = useCallback(async () => {
        if (!invoice) return;
        try {
            setIsSubmittingFiscal(true);
            const record = await InvoiceService.submitFiscalRecord(invoice.id);
            setFiscalRecord(record);
            toast.success(dict.invoices.fiscal_submit_success);
            await loadAllData();
        } catch (error: unknown) {
            toast.error(
                getErrorMessage(error, dict.invoices.fiscal_submit_error)
            );
        } finally {
            setIsSubmittingFiscal(false);
        }
    }, [
        dict.invoices.fiscal_submit_error,
        dict.invoices.fiscal_submit_success,
        invoice,
        loadAllData,
    ]);

    const handleFacturae = useCallback(async (sign: boolean) => {
        if (!invoice) return;
        try {
            setIsGeneratingFacturae(true);
            const result = await InvoiceService.generateFacturae(invoice.id, sign);
            await InvoiceService.downloadFacturae(invoice.id, result.filename);
            toast.success(dict.invoices.facturae_success);
            await loadAllData();
        } catch (error: unknown) {
            toast.error(
                getErrorMessage(error, dict.invoices.facturae_error)
            );
        } finally {
            setIsGeneratingFacturae(false);
        }
    }, [
        dict.invoices.facturae_error,
        dict.invoices.facturae_success,
        invoice,
        loadAllData,
    ]);

    useEffect(() => {
        if (loading || !invoice) return;
        const queryParams = new URLSearchParams(window.location.search);
        if (queryParams.get("print") === "true") {
            const timer = window.setTimeout(() => {
                void handlePdfAction();
                window.history.replaceState(null, "", `/dashboard/invoices/${invoice.id}`);
            }, 800);
            return () => window.clearTimeout(timer);
        }
    }, [handlePdfAction, invoice, loading]);

    const handleStatusChange = async (newStatus: string) => {
        if (!invoice) return;
        try {
            setUpdatingStatus(true);
            if (newStatus === "issued") {
                const blocker = getIssueBlocker(invoice, client, company);
                if (blocker) {
                    toast.error(blocker);
                    return;
                }
                await InvoiceService.issueInvoice(invoice.id);
            } else {
                await InvoiceService.updateInvoice(invoice.id, {
                    status: newStatus,
                });
            }
            toast.success(dict.invoices.success_status_update);
            await loadAllData();
        } catch (error: unknown) {
            console.error("Error updating invoice status", error);
            const message = getErrorMessage(error, dict.invoices.error_status_update);
            toast.error(translateIssueError(message));
        } finally {
            setUpdatingStatus(false);
        }
    };

    const handleEnterEditMode = () => {
        if (!invoice) return;
        setEditingInvoiceNumber(
            invoice.invoice_number.startsWith("DRAFT-") ? "" : invoice.invoice_number
        );
        setEditingIssueDate(toDateInputValue(invoice.issue_date));
        setEditingDueDate(toDateInputValue(invoice.due_date));
        setEditingPaymentMethod(invoice.payment_method || "bank_transfer");
        setEditingPricesIncludeTax(false);
        setEditingIssuerFields(editableIssuerFields(invoice, company));
        setEditingRecipientFields(editableRecipientFields(invoice, client));
        setEditingItems(
            (invoice.items || []).map((item) => ({
                id: item.id,
                clientKey: `invoice-item-${item.id}`,
                description: item.description,
                quantity: item.quantity,
                unit_price: item.unit_price,
                tax_rate: item.tax_rate,
                task_item_id: item.task_item_id,
            }))
        );
        setIsEditMode(true);
    };

    const openEditFromQueryEvent = useEffectEvent(() => {
        if (!invoice || invoice.status !== "draft" || isEditMode) return;
        const queryParams = new URLSearchParams(window.location.search);
        if (queryParams.get("edit") !== "true") return;
        handleEnterEditMode();
        window.history.replaceState(null, "", `/dashboard/invoices/${invoice.id}`);
    });

    useEffect(() => {
        if (loading || !invoice) return;
        let active = true;
        queueMicrotask(() => {
            if (active) openEditFromQueryEvent();
        });
        return () => {
            active = false;
        };
    }, [invoice, loading]);

    const handleDiscardEdit = () => {
        setIsEditMode(false);
        setEditingInvoiceNumber("");
        setEditingIssueDate("");
        setEditingDueDate("");
        setEditingPaymentMethod("bank_transfer");
        setEditingPricesIncludeTax(false);
        setEditingIssuerFields(EMPTY_BILLING_PARTY_FIELDS);
        setEditingRecipientFields(EMPTY_BILLING_PARTY_FIELDS);
        setEditingItems([]);
    };

    const handleEditIssuerFieldChange = (
        field: BillingPartyField,
        value: string
    ) => {
        setEditingIssuerFields((current) =>
            updateBillingPartyField(current, field, value)
        );
    };

    const handleEditRecipientFieldChange = (
        field: BillingPartyField,
        value: string
    ) => {
        setEditingRecipientFields((current) =>
            updateBillingPartyField(current, field, value)
        );
    };

    const handleAddEditItem = () => {
        setEditingItems((current) => [
            ...current,
            {
                clientKey: createEditableLineKey("invoice-item"),
                description: "",
                quantity: 1,
                unit_price: 0,
                tax_rate: 0.21,
            },
        ]);
    };

    const handleRemoveEditItem = (index: number) => {
        setEditingItems((current) =>
            current.filter((_, itemIndex) => itemIndex !== index)
        );
    };

    const handleEditItemChange = (
        index: number,
        field: keyof EditingInvoiceItem,
        value: string | number
    ) => {
        setEditingItems((current) =>
            current.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: value } : item
            )
        );
    };

    const handleEditingPricesIncludeTaxChange = (nextValue: boolean) => {
        setEditingItems((current) => current.map((item) => ({
            ...item,
            unit_price: priceForTaxMode(
                item.unit_price,
                item.tax_rate,
                editingPricesIncludeTax,
                nextValue,
            ),
        })));
        setEditingPricesIncludeTax(nextValue);
    };

    const handleSaveDraft = async () => {
        if (!invoice) return;
        const lineError = validateDocumentLines(
            editingItems.map((item) => ({
                description: item.description,
                quantity: item.quantity,
                unitPrice: item.unit_price,
            }))
        );
        if (lineError) {
            const messages = {
                empty: "Añade al menos una línea a la factura.",
                description: "Completa la descripción de todas las líneas.",
                quantity: "La cantidad de cada línea debe ser mayor que cero.",
                "unit-price": "El precio de una línea no puede ser negativo.",
            };
            toast.error(messages[lineError]);
            return;
        }
        try {
            setIsSavingDraft(true);
            const headerPayload = {
                issue_date: editingIssueDate
                    ? new Date(editingIssueDate).toISOString()
                    : invoice.issue_date,
                due_date: editingDueDate
                    ? new Date(editingDueDate).toISOString()
                    : null,
                payment_method: editingPaymentMethod,
                custom_issuer_info: formatBillingParty(editingIssuerFields),
                custom_recipient_info: formatBillingParty(editingRecipientFields),
                ...(editingInvoiceNumber.trim()
                    ? { invoice_number: editingInvoiceNumber.trim() }
                    : {}),
                items: editingItems.map((item) => ({
                    description: item.description.trim(),
                    quantity: item.quantity,
                    unit_price: editingPricesIncludeTax
                        ? priceExcludingTax(item.unit_price, item.tax_rate)
                        : item.unit_price,
                    tax_rate: item.tax_rate,
                    task_item_id: item.task_item_id,
                })),
            };
            await InvoiceService.updateInvoice(invoice.id, headerPayload);
            toast.success("Borrador actualizado correctamente");
            setIsEditMode(false);
            setEditingInvoiceNumber("");
            setEditingIssueDate("");
            setEditingDueDate("");
            setEditingPaymentMethod("bank_transfer");
            setEditingPricesIncludeTax(false);
            setEditingIssuerFields(EMPTY_BILLING_PARTY_FIELDS);
            setEditingRecipientFields(EMPTY_BILLING_PARTY_FIELDS);
            setEditingItems([]);
            await loadAllData();
        } catch (error: unknown) {
            toast.error(
                getErrorMessage(error, "Error guardando el borrador")
            );
        } finally {
            setIsSavingDraft(false);
        }
    };

    const editBillingTotals = useMemo(
        () =>
            invoice
                ? calculatePerLineTaxTotals(
                    editingItems.map((item) => ({
                        quantity: item.quantity,
                        unitPrice: item.unit_price,
                        taxRate: item.tax_rate,
                    })),
                    invoice.discount || 0,
                    invoice.equivalence_surcharge || 0,
                    invoice.retention || 0,
                    editingPricesIncludeTax,
                )
                : null,
        [editingItems, editingPricesIncludeTax, invoice]
    );

    const invoiceParties = useMemo(() => {
        const issuerSnapshot = invoice?.issuer_snapshot || {};
        const recipientSnapshot = invoice?.recipient_snapshot || {};
        return {
            issuerName: String(
                issuerSnapshot.name || company?.name || "WorkHive Enterprise"
            ),
            issuerTaxId: String(
                issuerSnapshot.tax_id || company?.tax_id || "-"
            ),
            issuerAddress: String(
                issuerSnapshot.address || company?.address || ""
            ),
            issuerEmail: String(
                issuerSnapshot.email || company?.email || ""
            ),
            issuerPhone: String(
                issuerSnapshot.phone || company?.phone || ""
            ),
            issuerLogo: String(issuerSnapshot.logo || company?.logo || ""),
            recipientName: String(
                recipientSnapshot.name || client?.name || "-"
            ),
            recipientTaxId: String(
                recipientSnapshot.tax_id || client?.legal_number || "-"
            ),
            recipientAddress: String(
                recipientSnapshot.address || client?.address || ""
            ),
            recipientPostalCode: String(
                recipientSnapshot.postal_code || client?.postal_code || ""
            ),
            recipientCity: String(
                recipientSnapshot.city || client?.city || ""
            ),
            recipientCountry: String(
                recipientSnapshot.country || client?.country || ""
            ),
            recipientEmail: String(
                recipientSnapshot.email || client?.email || ""
            ),
        };
    }, [client, company, invoice]);

    const draftFiscalPreview = useMemo(() => {
        if (!invoice || invoice.status !== "draft") return null;
        const recipientFields = isEditMode
            ? editingRecipientFields
            : editableRecipientFields(invoice, client);
        const code = hasTaxId(recipientFields.taxId) ? "F1" : "F2";
        return {
            code,
            title: code === "F1"
                ? dict.invoices.fiscal_type_f1_title
                : dict.invoices.fiscal_type_f2_title,
            description: code === "F1"
                ? dict.invoices.fiscal_type_f1_description
                : dict.invoices.fiscal_type_f2_description,
        };
    }, [client, dict.invoices, editingRecipientFields, invoice, isEditMode]);

    return {
        dict,
        user,
        userLoading,
        invoice,
        client,
        company,
        loading,
        updatingStatus,
        isRectificationOpen,
        setIsRectificationOpen,
        isEditMode,
        editingInvoiceNumber,
        setEditingInvoiceNumber,
        editingIssueDate,
        setEditingIssueDate,
        editingDueDate,
        setEditingDueDate,
        editingPaymentMethod,
        setEditingPaymentMethod,
        editingPricesIncludeTax,
        setEditingPricesIncludeTax: handleEditingPricesIncludeTaxChange,
        editingIssuerFields,
        editingRecipientFields,
        editingItems,
        isSavingDraft,
        isDownloadingPdf,
        isSendingEmail,
        fiscalRecord,
        fiscalReadiness,
        facturaeReadiness,
        isSubmittingFiscal,
        isGeneratingFacturae,
        loadAllData,
        handleStatusChange,
        handlePrint,
        handlePdfAction,
        handleSendEmail,
        handleSubmitFiscal,
        handleFacturae,
        handleEnterEditMode,
        handleDiscardEdit,
        handleAddEditItem,
        handleRemoveEditItem,
        handleEditItemChange,
        handleEditIssuerFieldChange,
        handleEditRecipientFieldChange,
        handleSaveDraft,
        editBillingTotals,
        draftFiscalPreview,
        formatDate: (value: string | null | undefined) => formatDateLong(value, locale === "en" ? "en-US" : "es-ES"),
        locale,
        nextStates: invoice ? ALLOWED_TRANSITIONS[invoice.status] || [] : [],
        ...invoiceParties,
    };
}
