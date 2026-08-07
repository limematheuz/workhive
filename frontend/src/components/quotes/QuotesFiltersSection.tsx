"use client";

import { Filter, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { Client } from "@/services/client.service";

type QuotesFiltersSectionProps = {
    clients: Client[];
    selectedClientId: string;
    onClientChange: (value: string) => void;
    selectedStatus: string;
    onStatusChange: (value: string) => void;
    statusLabels: Record<string, string>;
};

export function QuotesFiltersSection({
    clients,
    selectedClientId,
    onClientChange,
    selectedStatus,
    onStatusChange,
    statusLabels,
}: QuotesFiltersSectionProps) {
    const hasFilters = Boolean(selectedClientId || selectedStatus);

    return (
        <section className="billing-surface mb-4 rounded-[22px] p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    <Filter className="h-4 w-4 text-[var(--btn-secondary-text)]" aria-hidden="true" />
                    Filtros
                </div>
                {hasFilters && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                            onClientChange("");
                            onStatusChange("");
                        }}
                    >
                        <RotateCcw />
                        Restablecer
                    </Button>
                )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                    <span className="sr-only">Todos los clientes</span>
                    <select
                        aria-label="Todos los clientes"
                        value={selectedClientId || "all"}
                        onChange={(e) => onClientChange(e.target.value === "all" ? "" : e.target.value)}
                        className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none transition focus:border-accent"
                    >
                        <option value="all">Todos los clientes</option>
                        {clients.map((c) => (
                            <option key={c.id} value={c.id.toString()}>{c.name}</option>
                        ))}
                    </select>
                </label>
                <label className="block">
                    <span className="sr-only">Todos los estados</span>
                    <select
                        aria-label="Todos los estados"
                        value={selectedStatus || "all"}
                        onChange={(e) => onStatusChange(e.target.value === "all" ? "" : e.target.value)}
                        className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none transition focus:border-accent"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="draft">{statusLabels.draft}</option>
                        <option value="sent">{statusLabels.sent}</option>
                        <option value="accepted">{statusLabels.accepted}</option>
                        <option value="rejected">{statusLabels.rejected}</option>
                        <option value="expired">{statusLabels.expired}</option>
                    </select>
                </label>
            </div>
        </section>
    );
}
