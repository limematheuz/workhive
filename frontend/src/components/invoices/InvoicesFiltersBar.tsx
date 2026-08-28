"use client";

import { RotateCcw, Search, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

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
                <div className="relative block">
                    <span className="sr-only">{labels.search_invoice_placeholder}</span>
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                    <Input
                        value={search}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={labels.search_invoice_placeholder}
                        className="h-11 w-full rounded-xl pl-10 pr-3 text-sm"
                    />
                </div>
                <div className="block">
                    <span className="sr-only">{labels.filter_all_clients || "Todos los clientes"}</span>
                    <Select
                        value={selectedClientId}
                        onValueChange={(value) => onClientChange(value === "__all-clients__" ? "" : value)}
                    >
                        <SelectTrigger
                            aria-label={labels.filter_all_clients || "Todos los clientes"}
                            className="h-11 w-full"
                        >
                            <SelectValue placeholder={labels.filter_all_clients || "Todos los clientes"} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all-clients__">{labels.filter_all_clients || "Todos los clientes"}</SelectItem>
                            {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id.toString()}>{client.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="block">
                    <span className="sr-only">{labels.filter_all_statuses || "Todos los estados"}</span>
                    <Select
                        value={selectedStatus}
                        onValueChange={(value) => onStatusChange(value === "__all-statuses__" ? "" : value)}
                    >
                        <SelectTrigger
                            aria-label={labels.filter_all_statuses || "Todos los estados"}
                            className="h-11 w-full"
                        >
                            <SelectValue placeholder={labels.filter_all_statuses || "Todos los estados"} />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all-statuses__">{labels.filter_all_statuses || "Todos los estados"}</SelectItem>
                            <SelectItem value="draft">{labels.status_draft}</SelectItem>
                            <SelectItem value="issued">{labels.status_issued}</SelectItem>
                            <SelectItem value="paid">{labels.status_paid}</SelectItem>
                            <SelectItem value="overdue">{labels.status_overdue}</SelectItem>
                            <SelectItem value="cancelled">{labels.status_cancelled}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="block">
                    <span className="sr-only">{monthLabel}</span>
                    <DatePicker
                        id="invoices-month-filter"
                        value={month ? `${month}-01` : ""}
                        onValueChange={(value) => onMonthChange(value.slice(0, 7))}
                        aria-label={monthLabel}
                        className="h-11 w-full rounded-xl text-sm font-semibold"
                    />
                </div>
            </div>
        </section>
    );
}
