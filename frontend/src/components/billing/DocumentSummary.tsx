"use client";

import {
    EquivalenceSurchargeSelect,
    RetentionSelect,
    TaxRateSelect,
} from "@/components/billing/BillingSelectors";
import type { Dictionary } from "@/lib/dictionary-context";

interface DocumentSummaryProps {
    dict: Dictionary;
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
}

export function DocumentSummary({
    dict,
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
}: DocumentSummaryProps) {
    return (
        <section className="space-y-3 border-t border-[var(--border-soft)] pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-main)]">
                {dict.invoices?.summary_title || "Resumen"}
            </h3>

            <div className="space-y-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/30 p-4 text-xs">
                <div className="flex justify-between font-medium">
                    <span className="text-[var(--text-muted)]">
                        {dict.invoices?.subtotal_desc || "Subtotal"}
                    </span>
                    <span className="font-mono font-semibold">
                        {subtotal.toFixed(2)} €
                    </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                    <span className="shrink-0 text-[var(--text-muted)]">
                        {dict.invoices?.global_tax || "IVA"}
                    </span>
                    <TaxRateSelect
                        value={taxRateGlobal}
                        onChange={handleGlobalTaxRateChange}
                    />
                </div>

                <details className="group rounded-xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/50">
                    <summary className="cursor-pointer list-none px-3 py-2 font-semibold text-[var(--text-muted)] marker:hidden">
                        Ajustes fiscales avanzados
                    </summary>
                    <div className="space-y-3 border-t border-[var(--border-soft)] px-3 py-3">
                        <div className="flex items-center justify-between gap-4">
                            <span className="shrink-0 text-[var(--text-muted)]">
                                {dict.invoices?.global_discount || "Descuento"}
                            </span>
                            <div className="relative flex w-24 items-center">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={discount || ""}
                                    onChange={(event) =>
                                        setDiscount(Number(event.target.value) || 0)
                                    }
                                    aria-label={dict.invoices?.global_discount || "Descuento"}
                                    className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] py-1 pl-2 pr-6 text-right font-mono text-xs text-[var(--text-main)] outline-none"
                                />
                                <span className="absolute right-2 font-mono text-2xs text-[var(--text-muted)]">
                                    %
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="shrink-0 text-[var(--text-muted)]">
                                {dict.invoices?.equivalence_surcharge || "Recargo de equivalencia"}
                            </span>
                            <EquivalenceSurchargeSelect
                                value={equivalenceSurcharge}
                                onChange={setEquivalenceSurcharge}
                                dict={dict}
                            />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="shrink-0 text-[var(--text-muted)]">
                                {dict.invoices?.retention_irpf || "Retención (IRPF)"}
                            </span>
                            <RetentionSelect
                                value={retention}
                                onChange={setRetention}
                                dict={dict}
                            />
                        </div>
                    </div>
                </details>

                <div className="space-y-1.5 border-t border-[var(--border-soft)] pt-2 font-mono text-3xs text-[var(--text-muted)]">
                    <div className="flex justify-between">
                        <span>{dict.invoices?.taxable_base || "Base imponible:"}</span>
                        <span>{baseAmount.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between">
                        <span>{dict.invoices?.tax_label || "IVA:"}</span>
                        <span>{taxAmount.toFixed(2)} €</span>
                    </div>
                    {equivalenceSurcharge > 0 && (
                        <div className="flex justify-between">
                            <span>{dict.invoices?.surcharge_label || "Recargo:"}</span>
                            <span>{surchargeAmount.toFixed(2)} €</span>
                        </div>
                    )}
                    {retention > 0 && (
                        <div className="flex justify-between text-rose-500">
                            <span>{dict.invoices?.retention_label || "Retención:"}</span>
                            <span>-{retentionAmount.toFixed(2)} €</span>
                        </div>
                    )}
                </div>

                <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--text-main)] p-3 text-white shadow-sm dark:bg-white dark:text-black">
                    <span className="text-xs font-bold uppercase tracking-wider">
                        {dict.invoices?.total_general || "Total"}
                    </span>
                    <span className="font-mono text-base font-bold">
                        {totalGeneral.toFixed(2)} €
                    </span>
                </div>
            </div>
        </section>
    );
}
