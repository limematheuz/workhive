"use client";

import React from "react";
import {
    EQUIVALENCE_SURCHARGE_OPTIONS,
    RETENTION_OPTIONS,
    TAX_RATE_OPTIONS,
} from "@/lib/constants";
import {
    parsePercentOptionValue,
    parseTaxRateOptionValue,
    percentToOptionValue,
    taxRateToOptionValue,
} from "@/lib/billing-calculations";

const selectClassName =
    "w-28 bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg px-1.5 py-1 text-xs outline-none text-right font-mono";

interface TaxRateSelectProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
}

export function TaxRateSelect({ value, onChange, className }: TaxRateSelectProps) {
    return (
        <select
            aria-label="Tipo de IVA"
            value={taxRateToOptionValue(value)}
            onChange={(e) => onChange(parseTaxRateOptionValue(e.target.value))}
            className={className ?? selectClassName}
        >
            {TAX_RATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

interface PercentSelectProps {
    value: number;
    onChange: (value: number) => void;
    options: ReadonlyArray<{ value: string; label?: string; labelKey?: string; fallback?: string }>;
    dict?: { invoices?: Record<string, string> };
    className?: string;
}

function PercentSelect({
    value,
    onChange,
    options,
    dict,
    className,
}: PercentSelectProps) {
    return (
        <select
            aria-label="Porcentaje"
            value={percentToOptionValue(value)}
            onChange={(e) => onChange(parsePercentOptionValue(e.target.value))}
            className={className ?? selectClassName}
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label
                        ?? (option.labelKey
                            ? dict?.invoices?.[option.labelKey] ?? option.fallback
                            : option.fallback)}
                </option>
            ))}
        </select>
    );
}

export function EquivalenceSurchargeSelect(
    props: Omit<PercentSelectProps, "options">,
) {
    return <PercentSelect {...props} options={EQUIVALENCE_SURCHARGE_OPTIONS} />;
}

export function RetentionSelect(props: Omit<PercentSelectProps, "options">) {
    return <PercentSelect {...props} options={RETENTION_OPTIONS} />;
}
