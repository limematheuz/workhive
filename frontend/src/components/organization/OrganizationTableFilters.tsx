import { Search, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type OrganizationTableFiltersProps = {
    search: string;
    onSearchChange: (value: string) => void;
    searchPlaceholder: string;
    shownCount: number;
    totalCount: number;
    summary: string;
    clearLabel: string;
    onClear: () => void;
    hasActiveFilters: boolean;
    children: ReactNode;
};

export function OrganizationTableFilters({
    search,
    onSearchChange,
    searchPlaceholder,
    shownCount,
    totalCount,
    summary,
    clearLabel,
    onClear,
    hasActiveFilters,
    children,
}: OrganizationTableFiltersProps) {
    return (
        <div className="border-y border-[var(--border-soft)] bg-[var(--bg-secondary)]/25 px-5 py-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="relative min-w-0 lg:w-80">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                    <Input
                        type="search"
                        value={search}
                        onChange={(event) => onSearchChange(event.target.value)}
                        placeholder={searchPlaceholder}
                        aria-label={searchPlaceholder}
                        className="h-10 pl-9"
                    />
                </div>
                <div className="flex flex-1 flex-wrap gap-2">
                    {children}
                    {hasActiveFilters && (
                        <Button type="button" variant="ghost" size="sm" className="h-10 px-3 text-[var(--text-muted)] hover:text-[var(--text-main)]" onClick={onClear}>
                            <X className="mr-1.5 h-4 w-4" aria-hidden="true" />
                            {clearLabel}
                        </Button>
                    )}
                </div>
                <p className="shrink-0 text-xs font-medium text-[var(--text-muted)]" aria-live="polite">
                    {summary.replace("{shown}", String(shownCount)).replace("{total}", String(totalCount))}
                </p>
            </div>
        </div>
    );
}
