"use client";

import { RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClientWorkspaceFilter } from "@/lib/client-workspace";
import { useDictionary } from "@/lib/dictionary-context";

type ClientWorkspaceFiltersProps = {
    filters: ClientWorkspaceFilter;
    cities: string[];
    onChange: (filters: ClientWorkspaceFilter) => void;
};

const EMPTY_FILTERS: ClientWorkspaceFilter = {
    search: "",
    status: "all",
    clientType: "all",
    city: "",
    contact: "all",
};

export function ClientWorkspaceFilters({ filters, cities, onChange }: ClientWorkspaceFiltersProps) {
    const { dict } = useDictionary();
    const workspace = dict.clients.workspace;
    const hasFilters = Object.entries(filters).some(([key, value]) => key === "search" ? Boolean(value) : value !== EMPTY_FILTERS[key as keyof ClientWorkspaceFilter]);
    const update = <Key extends keyof ClientWorkspaceFilter>(key: Key, value: ClientWorkspaceFilter[Key]) => {
        onChange({ ...filters, [key]: value });
    };

    return (
        <section className="billing-surface rounded-[22px] p-3 sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block min-w-0 flex-1 sm:max-w-[31rem]">
                    <span className="sr-only">{workspace.search_label}</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                    <Input
                        value={filters.search}
                        onChange={(event) => update("search", event.target.value)}
                        placeholder={workspace.search}
                        className="h-11 border-[var(--border-color)] bg-[var(--bg-card-solid)] pl-10 text-sm font-semibold shadow-none placeholder:text-[var(--text-muted)] focus-visible:border-accent"
                    />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                    {hasFilters && (
                        <Button type="button" variant="secondary" size="xs" onClick={() => onChange(EMPTY_FILTERS)}>
                            <RotateCcw aria-hidden="true" /> {workspace.clear_filters}
                        </Button>
                    )}
                </div>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <FilterSelect
                    label={workspace.filter_status}
                    value={filters.status}
                    onChange={(value) => update("status", value as ClientWorkspaceFilter["status"])}
                    options={[
                        { value: "all", label: workspace.all },
                        { value: "active", label: dict.clients.table.active },
                        { value: "inactive", label: dict.clients.table.inactive },
                    ]}
                />
                <FilterSelect
                    label={workspace.filter_type}
                    value={filters.clientType}
                    onChange={(value) => update("clientType", value as ClientWorkspaceFilter["clientType"])}
                    options={[
                        { value: "all", label: workspace.all },
                        { value: "business", label: dict.clients.table.company },
                        { value: "individual", label: dict.clients.table.individual },
                        { value: "company", label: dict.clients.table.collaborator },
                    ]}
                />
                <FilterSelect
                    label={workspace.filter_zone}
                    value={filters.city}
                    onChange={(value) => update("city", value)}
                    options={[{ value: "", label: workspace.all_feminine }, ...cities.map((city) => ({ value: city, label: city }))]}
                />
                <FilterSelect
                    label={workspace.filter_contact}
                    value={filters.contact}
                    onChange={(value) => update("contact", value as ClientWorkspaceFilter["contact"])}
                    options={[
                        { value: "all", label: workspace.all },
                        { value: "complete", label: workspace.with_contact },
                        { value: "missing", label: workspace.pending },
                    ]}
                />
            </div>
        </section>
    );
}

function FilterSelect({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
}) {
    return (
        <label className="grid gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</span>
            <select
                aria-label={label}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] px-3 text-sm font-semibold text-[var(--text-main)] outline-none transition focus:border-accent"
            >
                {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
        </label>
    );
}
