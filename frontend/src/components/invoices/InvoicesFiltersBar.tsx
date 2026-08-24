"use client";

import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { Client } from "@/services/client.service";

type InvoicesFiltersBarProps = {
    search: string;
    onSearchChange: (value: string) => void;
    selectedClientId: string;
    onClientChange: (value: string) => void;
    selectedStatus: string;
    onStatusChange: (value: string) => void;
    month: string;
    onMonthChange: (value: string) => void;
    monthLabel: string;
    onReset: () => void;
    clients: Client[];
    labels: {
        search_invoice_placeholder: string;
        filter_all_clients?: string;
        filter_all_statuses?: string;
        status_draft: string;
        status_issued: string;
        status_paid: string;
        status_overdue: string;
        status_cancelled: string;
        reset?: string;
        search_and_filter?: string;
    };
};

export function InvoicesFiltersBar({
    search,
    onSearchChange,
    selectedClientId,
    onClientChange,
    selectedStatus,
    onStatusChange,
    month,
    onMonthChange,
    monthLabel,
    onReset,
    clients,
    labels,
}: InvoicesFiltersBarProps) {
    const hasFilters = Boolean(search || selectedClientId || selectedStatus || month);

    return (
        <section className="billing-surface rounded-[22px] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                    <SlidersHorizontal className="h-4 w-4 text-[var(--btn-secondary-text)]" />
                    {labels.search_and_filter || "Search and filter"}
                </div>
                {hasFilters && (
                    <Button type="button" variant="secondary" size="xs" onClick={onReset}>
                        <RotateCcw />
                        {labels.reset || "Reset"}
                    </Button>
                )}
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_13rem_13rem_11rem]">
                <label className="relative block">
                    <span className="sr-only">{labels.search_invoice_placeholder}</span>
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={labels.search_invoice_placeholder}
                        className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] pl-10 pr-3 text-sm text-[var(--text-main)] outline-none transition focus:border-accent"
                    />
                </label>
                <label className="block">
                    <span className="sr-only">{labels.filter_all_clients || "Todos los clientes"}</span>
                    <select
                        aria-label={labels.filter_all_clients || "Todos los clientes"}
                        value={selectedClientId}
                        onChange={(e) => onClientChange(e.target.value)}
                        className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none transition focus:border-accent"
                    >
                        <option value="">{labels.filter_all_clients || "Todos los clientes"}</option>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </label>
                <label className="block">
                    <span className="sr-only">{labels.filter_all_statuses || "Todos los estados"}</span>
                    <select
                        aria-label={labels.filter_all_statuses || "Todos los estados"}
                        value={selectedStatus}
                        onChange={(e) => onStatusChange(e.target.value)}
                        className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none transition focus:border-accent"
                    >
                        <option value="">{labels.filter_all_statuses || "Todos los estados"}</option>
                        <option value="draft">{labels.status_draft}</option>
                        <option value="issued">{labels.status_issued}</option>
                        <option value="paid">{labels.status_paid}</option>
                        <option value="overdue">{labels.status_overdue}</option>
                        <option value="cancelled">{labels.status_cancelled}</option>
                    </select>
                </label>
                <label className="block">
                    <span className="sr-only">{monthLabel}</span>
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => onMonthChange(e.target.value)}
                        aria-label={monthLabel}
                        className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none transition focus:border-accent"
                    />
                </label>
            </div>
        </section>
    );
}
