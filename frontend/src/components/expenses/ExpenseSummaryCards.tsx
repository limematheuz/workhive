"use client";

import { type ReactNode } from "react";
import { Hash, ReceiptText, WalletCards } from "lucide-react";

import { useDictionary } from "@/lib/dictionary-context";
import { formatCurrency } from "@/lib/format";

type ExpenseSummaryCardsProps = {
    total: number;
    tax: number;
    records: number;
};

export function ExpenseSummaryCards({ total, tax, records }: ExpenseSummaryCardsProps) {
    const { dict } = useDictionary();
    const text = dict.expenses;

    const cards = [
        {
            label: text.total_spent,
            value: formatCurrency(total),
            icon: <WalletCards className="h-4 w-4" />,
        },
        {
            label: text.tax_amount,
            value: formatCurrency(tax),
            icon: <ReceiptText className="h-4 w-4" />,
        },
        {
            label: text.records,
            value: records.toString(),
            icon: <Hash className="h-4 w-4" />,
        },
    ];

    return (
        <section className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            {cards.map((card) => (
                <SummaryCard key={card.label} label={card.label} value={card.value} icon={card.icon} />
            ))}
        </section>
    );
}

function SummaryCard({
    label,
    value,
    icon,
}: {
    label: string;
    value: string;
    icon: ReactNode;
}) {
    return (
        <article className="billing-block rounded-[18px] p-3.5">
            <span
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent"
                aria-hidden="true"
            >
                {icon}
            </span>
            <p className="mt-3 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-muted)] sm:text-[10px]">
                {label}
            </p>
            <p className="mt-1 text-xl font-semibold text-[var(--text-main)] sm:text-2xl">{value}</p>
        </article>
    );
}
