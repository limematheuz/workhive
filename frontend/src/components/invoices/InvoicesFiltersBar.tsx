"use client";

import { Search } from "lucide-react";

import type { Client } from "@/services/client.service";

type InvoicesFiltersBarProps = {
    search: string;
    onSearchChange: (value: string) => void;
    selectedClientId: string;
    onClientChange: (value: string) => void;
    selectedStatus: string;
    onStatusChange: (value: string) => void;
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
    };
};

export function InvoicesFiltersBar({
    search,
    onSearchChange,
    selectedClientId,
    onClientChange,
    selectedStatus,
    onStatusChange,
    clients,
    labels,
}: InvoicesFiltersBarProps) {
    return (
        <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={labels.search_invoice_placeholder}
                        className="h-11 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] pl-10 pr-3 text-sm text-[var(--text-main)] outline-none transition focus:border-accent"
                    />
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:w-[420px]">
                    <select
                        aria-label={labels.filter_all_clients || "Todos los clientes"}
                        value={selectedClientId}
                        onChange={(e) => onClientChange(e.target.value)}
                        className="h-11 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 text-xs font-bold text-[var(--text-main)] outline-none transition focus:border-accent"
                    >
                        <option value="">{labels.filter_all_clients || "Todos los clientes"}</option>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                    <select
                        aria-label={labels.filter_all_statuses || "Todos los estados"}
                        value={selectedStatus}
                        onChange={(e) => onStatusChange(e.target.value)}
                        className="h-11 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-3 text-xs font-bold text-[var(--text-main)] outline-none transition focus:border-accent"
                    >
                        <option value="">{labels.filter_all_statuses || "Todos los estados"}</option>
                        <option value="draft">{labels.status_draft}</option>
                        <option value="issued">{labels.status_issued}</option>
                        <option value="paid">{labels.status_paid}</option>
                        <option value="overdue">{labels.status_overdue}</option>
                        <option value="cancelled">{labels.status_cancelled}</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
