"use client";

import { Pencil, Receipt, Search, StickyNote, Trash2 } from "lucide-react";

import { ActionPopover, type PopoverOption } from "@/components/ui/action-popover";
import { DataListTable } from "@/components/ui/data-list-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDictionary } from "@/lib/dictionary-context";
import { formatExpenseDate, getExpenseNotes } from "@/lib/expense-form";
import { formatCurrency } from "@/lib/format";
import type { Expense } from "@/types/expense";
import { CATEGORY_OPTIONS } from "./expense-options";

type ExpensesListSectionProps = {
    expenses: Expense[];
    search: string;
    onSearchChange: (value: string) => void;
    categoryFilter: string;
    onCategoryFilterChange: (value: string) => void;
    month: string;
    onMonthChange: (value: string) => void;
    onEdit: (expense: Expense) => void;
    onDelete: (expense: Expense) => void;
    canManage: boolean;
};

export function ExpensesListSection({
    expenses,
    search,
    onSearchChange,
    categoryFilter,
    onCategoryFilterChange,
    month,
    onMonthChange,
    onEdit,
    onDelete,
    canManage,
}: ExpensesListSectionProps) {
    const { dict } = useDictionary();
    const text = dict.expenses;

    const getExpenseActions = (expense: Expense): PopoverOption[] => !canManage ? [] : [
        {
            label: text.edit,
            icon: Pencil,
            variant: "edit",
            onClick: () => onEdit(expense),
        },
        {
            label: text.delete,
            icon: Trash2,
            variant: "delete",
            onClick: () => onDelete(expense),
        },
    ];
    const operationalScopeLabel = (expense: Expense) => expense.service_contract_id
        ? `${text.operational_assignment_contract} #${expense.service_contract_id}`
        : expense.work_order_id
            ? `${text.operational_assignment_work_order} #${expense.work_order_id}`
            : null;

    return (
        <DataListTable
            items={expenses}
            getRowKey={(expense) => expense.id}
            desktopFrom="lg"
            header={{
                title: text.list_title,
                subtitle: text.list_subtitle,
                countLabel: `${expenses.length} ${expenses.length === 1 ? "gasto" : "gastos"}`,
            }}
            toolbar={(
                <div className="mb-2 flex flex-col gap-2 sm:flex-row">
                    <label className="relative block w-full sm:max-w-xs">
                        <span className="sr-only">{text.search}</span>
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                        <Input
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            aria-label={text.search}
                            className="h-11 w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-solid)] pl-10 pr-3 text-sm text-[var(--text-main)] outline-none transition focus:border-accent"
                            placeholder={text.search}
                        />
                    </label>
                    <label className="block sm:w-56">
                        <span className="sr-only">{text.all_categories}</span>
                        <Select
                            value={categoryFilter || "__all-categories__"}
                            onValueChange={(value) => onCategoryFilterChange(value === "__all-categories__" ? "" : value)}
                        >
                            <SelectTrigger aria-label={text.all_categories} className="h-11 w-full"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__all-categories__">{text.all_categories}</SelectItem>
                                {CATEGORY_OPTIONS.map((category) => (
                                    <SelectItem key={category} value={category}>
                                    {text.categories[category as keyof typeof text.categories] || category}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </label>
                    <label className="block sm:w-44">
                        <span className="sr-only">{text.month}</span>
                        <DatePicker
                            id="expenses-month-filter"
                            value={month ? `${month}-01` : ""}
                            onValueChange={(value) => onMonthChange(value ? value.slice(0, 7) : "")}
                            aria-label={text.month}
                            className="h-11 w-full rounded-xl text-sm font-semibold"
                        />
                    </label>
                </div>
            )}
            columns={[
                { key: "date", label: text.date },
                { key: "description", label: text.description },
                { key: "vendor", label: text.vendor },
                { key: "category", label: text.category },
                { key: "base", label: text.base_short, className: "text-right" },
                { key: "tax", label: text.tax_short, className: "text-right" },
                { key: "total", label: text.total, className: "text-right" },
                { key: "actions", label: text.actions, className: "sr-only" },
            ]}
            empty={(
                <>
                    <Receipt className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{text.empty}</p>
                </>
            )}
            renderCompactRow={(expense) => (
                <>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--text-main)]">{expense.description}</p>
                            <div className="mt-1 flex min-w-0 items-center gap-2">
                                <p className="truncate text-xs text-[var(--text-muted)]">{expense.vendor || text.no_vendor}</p>
                                <ExpenseNotesTooltip label={text.notes} notes={getExpenseNotes(expense)} />
                            </div>
                            {operationalScopeLabel(expense) && <p className="mt-1 truncate text-xs font-medium text-accent">{operationalScopeLabel(expense)}</p>}
                        </div>
                        <div className="flex shrink-0 items-start gap-2">
                            <span className="text-sm font-semibold text-[var(--text-main)]">{formatCurrency(expense.total_amount)}</span>
                            <ActionPopover options={getExpenseActions(expense)} />
                        </div>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[var(--border-soft)] pt-2.5 text-xs text-[var(--text-muted)]">
                        <span>{formatExpenseDate(expense.expense_date)}</span>
                        <span className="text-right">{text.categories[expense.category as keyof typeof text.categories] || expense.category}</span>
                        <span>{text.base_short}: {formatCurrency(expense.base_amount)}</span>
                        <span className="text-right">{text.tax_short}: {formatCurrency(expense.tax_amount)}</span>
                    </div>
                </>
            )}
            renderDesktopRow={(expense) => (
                <>
                    <span className="text-sm font-semibold text-[var(--text-main)]">{formatExpenseDate(expense.expense_date)}</span>
                    <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0">
                            <span className="block truncate font-semibold text-[var(--text-main)]">{expense.description}</span>
                            {operationalScopeLabel(expense) && <span className="block truncate text-xs font-medium text-accent">{operationalScopeLabel(expense)}</span>}
                        </span>
                        <ExpenseNotesTooltip label={text.notes} notes={getExpenseNotes(expense)} />
                    </span>
                    <span className="min-w-0 truncate text-sm text-[var(--text-muted)]">{expense.vendor || text.no_vendor}</span>
                    <span className="min-w-0">
                        <span className="inline-flex max-w-full rounded-full bg-[var(--bg-card-solid)] px-2.5 py-1 text-xs font-semibold text-[var(--text-main)]">
                            <span className="truncate">{text.categories[expense.category as keyof typeof text.categories] || expense.category}</span>
                        </span>
                    </span>
                    <span className="text-right text-sm font-semibold text-[var(--text-muted)]">{formatCurrency(expense.base_amount)}</span>
                    <span className="text-right text-sm font-semibold text-[var(--text-muted)]">{formatCurrency(expense.tax_amount)}</span>
                    <span className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(expense.total_amount)}</span>
                    <span className="flex justify-end">
                        <ActionPopover options={getExpenseActions(expense)} />
                    </span>
                </>
            )}
        />
    );
}

function ExpenseNotesTooltip({
    label,
    notes,
}: {
    label: string;
    notes: string;
}) {
    if (!notes) return null;

    return (
        <span className="group/note relative inline-flex shrink-0">
            <button
                type="button"
                title={notes}
                aria-label={`${label}: ${notes}`}
                onClick={(event) => event.stopPropagation()}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] transition hover:bg-[var(--btn-secondary-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
            >
                <StickyNote className="h-3.5 w-3.5" />
            </button>
            <span className="pointer-events-none absolute bottom-full left-0 z-[10090] mb-2 hidden w-72 max-w-[70vw] rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-3 text-left text-xs font-semibold leading-relaxed text-[var(--text-main)] shadow-xl group-hover/note:block group-focus-within/note:block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {label}
                </span>
                <span className="block max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                    {notes}
                </span>
            </span>
        </span>
    );
}
