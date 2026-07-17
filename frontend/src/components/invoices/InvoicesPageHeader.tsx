"use client";

import { Plus, Receipt } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";

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
        <PageHeader
            icon={Receipt}
            title={title}
            subtitle={subtitle}
            className="mb-6"
            actions={(
                <button
                    type="button"
                    onClick={onCreateInvoice}
                    className="flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--btn-primary-bg)] px-5 text-xs font-black text-[var(--btn-primary-text)] shadow-sm transition hover:bg-[var(--btn-primary-hover-bg)]"
                >
                    <Plus className="h-4 w-4" />
                    {newInvoiceLabel}
                </button>
            )}
        />
    );
}
