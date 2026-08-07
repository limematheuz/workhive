"use client";

import {
    EquivalenceSurchargeSelect,
    RetentionSelect,
    TaxRateSelect,
} from "@/components/billing/BillingSelectors";
import { ChevronDown } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";

interface DocumentSummaryProps {
    dict: Dictionary;
    title?: string;
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
    title,
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
        <section className="billing-surface overflow-hidden rounded-[24px]">
            <div className="border-b border-[var(--border-soft)] px-4 py-3.5">
                <div className="mb-3 h-1.5 w-full rounded-full bg-accent" />
                <h3 className="text-sm font-semibold text-[var(--text-main)]">
                    {title || dict.invoices?.summary_title || "Resumen"}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">Importes actualizados al momento</p>
            </div>

            <div className="space-y-3 p-4 text-xs">
                <div className="flex justify-between font-medium">
                    <span className="text-[var(--text-muted)]">
                        {dict.invoices?.subtotal_desc || "Subtotal"}
                    </span>
                    <span className="font-mono font-semibold text-[var(--text-main)]">
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

                <details className="group rounded-xl bg-[var(--bg-tertiary)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 font-semibold text-[var(--text-main)] marker:hidden">
                        Ajustes fiscales avanzados
                        <ChevronDown className="h-4 w-4 text-[var(--text-muted)] transition-transform group-open:rotate-180" aria-hidden="true" />
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
                                    className="block w-full min-w-0 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-solid)] py-1 pl-2 pr-6 text-right font-mono text-xs text-[var(--text-main)] outline-none"
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

                <div className="grid grid-cols-1 gap-2">
                    <div className="rounded-xl bg-[var(--bg-tertiary)] px-3 py-2.5">
                        <div className="flex justify-between font-mono text-[11px] text-[var(--text-muted)]">
                            <span>{dict.invoices?.taxable_base || "Base imponible"}</span>
                            <span className="font-semibold text-[var(--text-main)]">{baseAmount.toFixed(2)} €</span>
                        </div>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-tertiary)] px-3 py-2.5">
                        <div className="flex justify-between font-mono text-[11px] text-[var(--text-muted)]">
                            <span>{dict.invoices?.tax_label || "IVA"}</span>
                            <span className="font-semibold text-[var(--text-main)]">{taxAmount.toFixed(2)} €</span>
                        </div>
                    </div>
                    {equivalenceSurcharge > 0 && (
                        <div className="rounded-xl bg-[var(--bg-tertiary)] px-3 py-2.5">
                            <div className="flex justify-between font-mono text-[11px] text-[var(--text-muted)]">
                                <span>{dict.invoices?.surcharge_label || "Recargo"}</span>
                                <span className="font-semibold text-[var(--text-main)]">{surchargeAmount.toFixed(2)} €</span>
                            </div>
                        </div>
                    )}
                    {retention > 0 && (
                        <div className="rounded-xl bg-[var(--bg-tertiary)] px-3 py-2.5">
                            <div className="flex justify-between font-mono text-[11px] text-[var(--btn-cancel-text)]">
                                <span>{dict.invoices?.retention_label || "Retención"}</span>
                                <span className="font-semibold">-{retentionAmount.toFixed(2)} €</span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-1 flex items-center justify-between rounded-2xl bg-[color-mix(in_srgb,var(--accent-color)_12%,var(--bg-tertiary))] px-4 py-3 text-[var(--text-main)]">
                    <span className="text-xs font-semibold uppercase tracking-wider">
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
