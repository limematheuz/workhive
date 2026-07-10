"use client";

import { type ReactNode } from "react";
import { ReceiptText, WalletCards } from "lucide-react";

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

    return (
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <SummaryCard label={text.total_spent} value={formatCurrency(total)} icon={<WalletCards className="h-4 w-4" />} />
            <SummaryCard label={text.tax_amount} value={formatCurrency(tax)} icon={<ReceiptText className="h-4 w-4" />} />
            <SummaryCard label={text.records} value={records.toString()} icon={<ReceiptText className="h-4 w-4" />} />
        </div>
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
        <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--bg-card-solid)] text-accent">
                {icon}
            </div>
            <p className="text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">{label}</p>
            <p className="mt-2 text-2xl font-black text-[var(--text-main)]">{value}</p>
        </div>
    );
}
