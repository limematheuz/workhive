"use client";

import React from "react";
import { EquivalenceSurchargeSelect, RetentionSelect, TaxRateSelect } from "@/components/billing/BillingSelectors";
import type { Dictionary } from "@/lib/dictionary-context";

interface QuoteSummaryProps {
    dict: Dictionary;
    subtotal: number;
    discount: number;
    setDiscount: (val: number) => void;
    taxRateGlobal: number;
    handleGlobalTaxRateChange: (val: number) => void;
    equivalenceSurcharge: number;
    setEquivalenceSurcharge: (val: number) => void;
    retention: number;
    setRetention: (val: number) => void;
    baseAmount: number;
    taxAmount: number;
    surchargeAmount: number;
    retentionAmount: number;
    totalGeneral: number;
}

export function QuoteSummary({
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
}: QuoteSummaryProps) {
    return (
        <div className="space-y-4 pt-4 border-t border-[var(--border-soft)]">
            <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                {dict.invoices?.summary_title || "Resumen de Factura"}
            </h3>

            <div className="space-y-3 text-xs bg-[var(--bg-secondary)]/30 rounded-2xl p-4 border border-[var(--border-soft)] font-sans">
                <div className="flex justify-between font-medium">
                    <span className="text-[var(--text-muted)]">{dict.invoices?.subtotal_desc || "Subtotal (Suma de líneas)"}</span>
                    <span className="font-mono font-semibold">{subtotal.toFixed(2)} €</span>
                </div>

                {/* Discount Input */}
                <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--text-muted)] shrink-0">{dict.invoices?.global_discount || "Descuento Global"}</span>
                    <div className="relative flex items-center w-24">
                        <input
                            type="number"
                            min="0"
                            max="100"
                            value={discount || ""}
                            onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                            aria-label={dict.invoices?.global_discount || "Descuento Global"}
                            className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg pl-2 pr-6 py-1 text-xs text-right outline-none font-mono"
                        />
                        <span className="absolute right-2 text-2xs text-[var(--text-muted)] font-mono">%</span>
                    </div>
                </div>

                {/* Global Tax Selector */}
                <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--text-muted)] shrink-0">{dict.invoices?.global_tax || "Impuesto Global (IVA)"}</span>
                    <TaxRateSelect value={taxRateGlobal} onChange={handleGlobalTaxRateChange} />
                </div>

                {/* Equivalence Surcharge Selector */}
                <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--text-muted)] shrink-0">{dict.invoices?.equivalence_surcharge || "Recargo Equivalencia"}</span>
                    <EquivalenceSurchargeSelect value={equivalenceSurcharge} onChange={setEquivalenceSurcharge} dict={dict} />
                </div>

                {/* Retention Selector */}
                <div className="flex items-center justify-between gap-4">
                    <span className="text-[var(--text-muted)] shrink-0">{dict.invoices?.retention_irpf || "Retención (IRPF)"}</span>
                    <RetentionSelect value={retention} onChange={setRetention} dict={dict} />
                </div>

                {/* Calculations detail */}
                <div className="border-t border-[var(--border-soft)] pt-2 space-y-1.5 font-mono text-3xs text-[var(--text-muted)]">
                    <div className="flex justify-between">
                        <span>{dict.invoices?.taxable_base || "Base Imponible:"}</span>
                        <span>{baseAmount.toFixed(2)} €</span>
                    </div>
                    <div className="flex justify-between">
                        <span>{dict.invoices?.tax_label || "IVA:"}</span>
                        <span>{taxAmount.toFixed(2)} €</span>
                    </div>
                    {equivalenceSurcharge > 0 && (
                        <div className="flex justify-between">
                            <span>{dict.invoices?.surcharge_label || "Recargo de Equiv.:"}</span>
                            <span>{surchargeAmount.toFixed(2)} €</span>
                        </div>
                    )}
                    {retention > 0 && (
                        <div className="flex justify-between text-rose-500">
                            <span>{dict.invoices?.retention_label || "Retención (IRPF):"}</span>
                            <span>-{retentionAmount.toFixed(2)} €</span>
                        </div>
                    )}
                </div>

                {/* Total General Box */}
                <div className="bg-[var(--text-main)] dark:bg-white text-white dark:text-black rounded-xl p-3 flex justify-between items-center mt-2 shadow-sm">
                    <span className="text-xs font-bold uppercase tracking-wider">{dict.invoices?.total_general || "Total General"}</span>
                    <span className="text-base font-bold font-mono">{totalGeneral.toFixed(2)} €</span>
                </div>
            </div>
        </div>
    );
}
