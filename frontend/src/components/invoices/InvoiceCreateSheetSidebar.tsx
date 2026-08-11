"use client";

import { SignatureUpload } from "@/components/billing/SignatureUpload";
import { DocumentFormAdvancedPanel } from "@/components/billing/DocumentFormAdvancedPanel";
import { DocumentSummary } from "@/components/billing/DocumentSummary";
import { InvoiceTaskSelector } from "./InvoiceTaskSelector";
import type { InvoiceableTask } from "@/services/invoice.service";
import type { Dictionary } from "@/lib/dictionary-context";

type SelectableInvoiceTask = InvoiceableTask & { locationName: string };

interface InvoiceCreateSheetSidebarProps {
    dict: Dictionary;
    availableTasks: SelectableInvoiceTask[];
    selectedTaskIds: number[];
    loadingTasks: boolean;
    handleToggleAll: () => void;
    handleToggleTask: (task: SelectableInvoiceTask) => void;
    subtotal: number;
    discount: number;
    setDiscount: (value: number) => void;
    taxRateGlobal: number;
    handleGlobalTaxRateChange: (value: number) => void;
    equivalenceSurcharge: number;
    setEquivalenceSurcharge: (value: number) => void;
    retention: number;
    setRetention: (value: number) => void;
    baseAmount: number;
    taxAmount: number;
    surchargeAmount: number;
    retentionAmount: number;
    totalGeneral: number;
    signatureUrl: string | null;
    setSignatureUrl: (url: string | null) => void;
}

export function InvoiceCreateSheetSidebar({
    dict,
    availableTasks,
    selectedTaskIds,
    loadingTasks,
    handleToggleAll,
    handleToggleTask,
    subtotal,
    discount,
    setDiscount,
    taxRateGlobal,
    handleGlobalTaxRateChange,
    equivalenceSurcharge,
    setEquivalenceSurcharge,
    retention,
    setRetention,
    baseAmount,
    taxAmount,
    surchargeAmount,
    retentionAmount,
    totalGeneral,
    signatureUrl,
    setSignatureUrl,
}: InvoiceCreateSheetSidebarProps) {
    return (
        <div className="space-y-6">
            <InvoiceTaskSelector
                dict={dict}
                availableTasks={availableTasks}
                selectedTaskIds={selectedTaskIds}
                loadingTasks={loadingTasks}
                handleToggleAll={handleToggleAll}
                handleToggleTask={handleToggleTask}
            />

            <DocumentSummary
                dict={dict}
                subtotal={subtotal}
                discount={discount}
                setDiscount={setDiscount}
                taxRateGlobal={taxRateGlobal}
                handleGlobalTaxRateChange={handleGlobalTaxRateChange}
                equivalenceSurcharge={equivalenceSurcharge}
                setEquivalenceSurcharge={setEquivalenceSurcharge}
                retention={retention}
                setRetention={setRetention}
                baseAmount={baseAmount}
                taxAmount={taxAmount}
                surchargeAmount={surchargeAmount}
                retentionAmount={retentionAmount}
                totalGeneral={totalGeneral}
            />

            <DocumentFormAdvancedPanel title="Firma opcional" description="Añade una firma al PDF si la necesitas">
                <SignatureUpload
                    signatureUrl={signatureUrl}
                    onSignatureChange={setSignatureUrl}
                    dict={dict}
                />
            </DocumentFormAdvancedPanel>
        </div>
    );
}
