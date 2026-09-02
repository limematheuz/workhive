"use client";

import { RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    relationship: "all",
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
        <section className="billing-surface overflow-hidden rounded-[22px]">
            <div className="border-b border-[var(--border-soft)] bg-[var(--bg-secondary)]/25 px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block min-w-0 flex-1 sm:max-w-[31rem]">
                    <span className="sr-only">{workspace.search_label}</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                    <Input
                        value={filters.search}
                        onChange={(event) => update("search", event.target.value)}
                        placeholder={workspace.search}
                        className="h-10 bg-[var(--bg-primary)]/65 pl-10 text-sm font-medium shadow-none placeholder:text-[var(--text-muted)]"
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
            </div>
            <div className="grid gap-3 px-4 py-3 sm:grid-cols-2 sm:px-5 xl:grid-cols-5">
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
                    label={workspace.filter_relationship}
                    value={filters.relationship}
                    onChange={(value) => update("relationship", value as ClientWorkspaceFilter["relationship"])}
                    options={[
                        { value: "all", label: workspace.all },
                        { value: "lead", label: dict.clients.form.relationship_status_lead },
                        { value: "client", label: dict.clients.form.relationship_status_client },
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
            <Select value={value} onValueChange={onChange}>
            <SelectTrigger className="h-10 bg-[var(--bg-primary)]/65"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
            </Select>
        </label>
    );
}
