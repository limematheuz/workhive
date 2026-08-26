"use client";

import type { Dictionary } from "@/lib/dictionary-context";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
    "h-10 w-28 justify-between font-mono text-xs";

interface TaxRateSelectProps {
    value: number;
    onChange: (value: number) => void;
    className?: string;
}

export function TaxRateSelect({ value, onChange, className }: TaxRateSelectProps) {
    return (
        <Select
            value={taxRateToOptionValue(value)}
            onValueChange={(nextValue) => onChange(parseTaxRateOptionValue(nextValue))}
        >
            <SelectTrigger aria-label="Tipo de IVA" className={className ?? selectClassName}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {TAX_RATE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

interface PercentSelectProps {
    value: number;
    onChange: (value: number) => void;
    options: ReadonlyArray<{ value: string; label?: string; labelKey?: string; fallback?: string }>;
    dict?: Pick<Dictionary, "invoices">;
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
        <Select
            value={percentToOptionValue(value)}
            onValueChange={(nextValue) => onChange(parsePercentOptionValue(nextValue))}
        >
            <SelectTrigger aria-label="Porcentaje" className={className ?? selectClassName}>
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                        {option.label ?? getInvoiceLabel(dict, option.labelKey) ?? option.fallback}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function getInvoiceLabel(
    dict: Pick<Dictionary, "invoices"> | undefined,
    key: string | undefined,
): string | undefined {
    if (!key) return undefined;

    const value = (dict?.invoices as Record<string, unknown> | undefined)?.[key];
    return typeof value === "string" ? value : undefined;
}

export function EquivalenceSurchargeSelect(
    props: Omit<PercentSelectProps, "options">,
) {
    return <PercentSelect {...props} options={EQUIVALENCE_SURCHARGE_OPTIONS} />;
}

export function RetentionSelect(props: Omit<PercentSelectProps, "options">) {
    return <PercentSelect {...props} options={RETENTION_OPTIONS} />;
}
