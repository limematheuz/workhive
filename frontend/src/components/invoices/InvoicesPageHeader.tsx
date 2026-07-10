"use client";

import { Plus, Receipt } from "lucide-react";

type InvoicesPageHeaderProps = {
    title: string;
    subtitle: string;
    newInvoiceLabel: string;
    onCreateInvoice: () => void;
};

export function InvoicesPageHeader({
    title,
    subtitle,
    newInvoiceLabel,
    onCreateInvoice,
}: InvoicesPageHeaderProps) {
    return (
        <div className="flex flex-col gap-4 rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-4 shadow-sm sm:p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
                <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                        <Receipt className="h-5 w-5" />
                    </span>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-[var(--text-main)]">
                            {title}
                        </h1>
                        <p className="mt-1 text-xs font-medium text-[var(--text-muted)]">
                            {subtitle}
                        </p>
                    </div>
                </div>
            </div>
            <button
                type="button"
                onClick={onCreateInvoice}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--btn-primary-bg)] px-5 text-xs font-black text-[var(--btn-primary-text)] shadow-sm transition hover:bg-[var(--btn-primary-hover-bg)]"
            >
                <Plus className="h-4 w-4" />
                {newInvoiceLabel}
            </button>
        </div>
    );
}
