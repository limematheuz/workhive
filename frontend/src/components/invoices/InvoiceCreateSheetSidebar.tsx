"use client";

import { SignatureUpload } from "@/components/billing/SignatureUpload";
import { DocumentSummary } from "@/components/billing/DocumentSummary";
import { ChevronDown } from "lucide-react";
import { InvoiceTaskSelector } from "./InvoiceTaskSelector";
import type { TaskItem } from "@/services/task.service";
import type { Dictionary } from "@/lib/dictionary-context";

type SelectableInvoiceTask = TaskItem & { locationName: string };

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
        <div className="space-y-6 lg:sticky lg:top-1 lg:self-start lg:border-l lg:border-[var(--border-soft)] lg:pl-6">
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

            <details className="group rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/30">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-[var(--text-main)] marker:hidden">
                    <span>Firma opcional</span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-[var(--border-soft)] p-4">
                    <SignatureUpload
                        signatureUrl={signatureUrl}
                        onSignatureChange={setSignatureUrl}
                        dict={dict}
                    />
                </div>
            </details>
        </div>
    );
}
