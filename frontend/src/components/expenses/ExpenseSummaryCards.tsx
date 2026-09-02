"use client";

import { Hash, ReceiptText, WalletCards } from "lucide-react";

import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { useDictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";
import { getPercentageChange } from "@/lib/metric-trend";

type ExpenseSummaryCardsProps = {
    total: number;
    tax: number;
    records: number;
    previous?: { total: number; tax: number } | null;
};

export function ExpenseSummaryCards({ total, tax, records, previous = null }: ExpenseSummaryCardsProps) {
    const { dict } = useDictionary();
    const text = dict.expenses;
    const totalTrend = previous ? getPercentageChange(total, previous.total) : null;
    const taxTrend = previous ? getPercentageChange(tax, previous.tax) : null;

    const cards = [
        {
            label: text.total_spent,
            value: formatCurrency(total),
            icon: WalletCards,
            trend: totalTrend !== null
                ? { value: totalTrend, comparisonDirection: "lower" as const }
                : undefined,
        },
        {
            label: text.tax_amount,
            value: formatCurrency(tax),
            icon: ReceiptText,
            trend: taxTrend !== null
                ? { value: taxTrend, comparisonDirection: "lower" as const }
                : undefined,
        },
        {
            label: text.records,
            value: records.toString(),
            icon: Hash,
        },
    ];

    return (
        <SummaryMetricGrid desktopColumns={3} className="mt-5 gap-2.5">
            {cards.map((card) => (
                <SummaryMetricCard key={card.label} {...card} />
            ))}
        </SummaryMetricGrid>
    );
}
