import type { EditingInvoiceItem } from "@/hooks/useInvoiceDetail";
import type { BillingPartyField, BillingPartyFields } from "@/lib/billing-party";
import type { Dictionary } from "@/lib/dictionary-context";
import type { Company } from "@/services/company.service";
import type {
    FacturaeReadiness,
    FiscalInvoiceRecord,
    FiscalReadiness,
} from "@/services/invoice.service";
import type { Invoice, InvoicePaymentMethod } from "@/types/invoice";

export type DraftFiscalPreview = {
    code: string;
    title: string;
    description: string;
};

export type EditBillingTotals = {
    baseAmount: number;
    taxAmount: number;
    surchargeAmount: number;
    retentionAmount: number;
    discountAmount: number;
    totalAmount: number;
} | null;

export type InvoiceDetailDocumentProps = {
    dict: Dictionary;
    invoice: Invoice;
    company: Company | null;
    isEditMode: boolean;
    editingInvoiceNumber: string;
    editingIssueDate: string;
    editingDueDate: string;
    editingPaymentMethod: InvoicePaymentMethod;
    editingPricesIncludeTax: boolean;
    editingIssuerFields: BillingPartyFields;
    editingRecipientFields: BillingPartyFields;
    editingItems: EditingInvoiceItem[];
    editBillingTotals: EditBillingTotals;
    noticeCount: number;
    draftFiscalPreview: DraftFiscalPreview | null;
    fiscalRecord: FiscalInvoiceRecord | null;
    fiscalReadiness: FiscalReadiness | null;
    facturaeReadiness: FacturaeReadiness | null;
    formatDate: (value: string | null | undefined) => string;
    issuerName: string;
    issuerTaxId: string;
    issuerAddress: string;
    issuerEmail: string;
    issuerLogo: string;
    recipientName: string;
    recipientTaxId: string;
    recipientAddress: string;
    recipientPostalCode: string;
    recipientCity: string;
    recipientCountry: string;
    onSettingsChanged: () => Promise<void>;
    onEditingInvoiceNumberChange: (value: string) => void;
    onEditingIssueDateChange: (value: string) => void;
    onEditingDueDateChange: (value: string) => void;
    onEditingPaymentMethodChange: (value: InvoicePaymentMethod) => void;
    onEditingPricesIncludeTaxChange: (value: boolean) => void;
    onEditIssuerFieldChange: (field: BillingPartyField, value: string) => void;
    onEditRecipientFieldChange: (field: BillingPartyField, value: string) => void;
    onEditItemChange: (index: number, field: keyof EditingInvoiceItem, value: string | number) => void;
    onRemoveEditItem: (index: number) => void;
    onAddEditItem: () => void;
};
