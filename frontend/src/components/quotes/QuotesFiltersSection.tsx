"use client";

import { Filter, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
                <div className="block">
                    <Label className="sr-only">Todos los clientes</Label>
                    <Select
                        aria-label="Todos los clientes"
                        value={selectedClientId || "all"}
                        onValueChange={(value) => onClientChange(value === "all" ? "" : value)}
                    >
                        <SelectTrigger aria-label="Todos los clientes" className="h-11 w-full rounded-xl px-3 text-sm font-semibold">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        <SelectItem value="all">Todos los clientes</SelectItem>
                        {clients.map((c) => (
                            <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="block">
                    <Label className="sr-only">Todos los estados</Label>
                    <Select
                        aria-label="Todos los estados"
                        value={selectedStatus || "all"}
                        onValueChange={(value) => onStatusChange(value === "all" ? "" : value)}
                    >
                        <SelectTrigger aria-label="Todos los estados" className="h-11 w-full rounded-xl px-3 text-sm font-semibold">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            <SelectItem value="draft">{statusLabels.draft}</SelectItem>
                            <SelectItem value="sent">{statusLabels.sent}</SelectItem>
                            <SelectItem value="accepted">{statusLabels.accepted}</SelectItem>
                            <SelectItem value="rejected">{statusLabels.rejected}</SelectItem>
                            <SelectItem value="expired">{statusLabels.expired}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </section>
    );
}
