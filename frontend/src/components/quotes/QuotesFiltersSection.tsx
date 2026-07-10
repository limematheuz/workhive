"use client";

import { Filter } from "lucide-react";

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
    return (
        <div className="bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl p-5 mb-6 flex flex-col md:flex-row gap-4 items-center">
            <div className="flex items-center gap-2 text-[var(--text-muted)] self-start md:self-center">
                <Filter className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Filtros</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                <select
                    aria-label="Todos los clientes"
                    value={selectedClientId || "all"}
                    onChange={(e) => onClientChange(e.target.value === "all" ? "" : e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent cursor-pointer h-10 shadow-xs"
                >
                    <option value="all">Todos los clientes</option>
                    {clients.map((c) => (
                        <option key={c.id} value={c.id.toString()}>{c.name}</option>
                    ))}
                </select>
                <select
                    aria-label="Todos los estados"
                    value={selectedStatus || "all"}
                    onChange={(e) => onStatusChange(e.target.value === "all" ? "" : e.target.value)}
                    className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] text-[var(--text-main)] rounded-xl px-3 py-2 text-xs outline-none focus:border-accent cursor-pointer h-10 shadow-xs"
                >
                    <option value="all">Todos los estados</option>
                    <option value="draft">{statusLabels.draft}</option>
                    <option value="sent">{statusLabels.sent}</option>
                    <option value="accepted">{statusLabels.accepted}</option>
                    <option value="rejected">{statusLabels.rejected}</option>
                    <option value="expired">{statusLabels.expired}</option>
                </select>
            </div>
        </div>
    );
}
