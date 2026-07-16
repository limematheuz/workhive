"use client";

import { Pencil, Search, StickyNote, Trash2 } from "lucide-react";

import { ActionPopover, type PopoverOption } from "@/components/ui/action-popover";
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
    onEdit: (expense: Expense) => void;
    onDelete: (expense: Expense) => void;
};

export function ExpensesListSection({
    expenses,
    search,
    onSearchChange,
    categoryFilter,
    onCategoryFilterChange,
    onEdit,
    onDelete,
}: ExpensesListSectionProps) {
    const { dict } = useDictionary();
    const text = dict.expenses;

    const getExpenseActions = (expense: Expense): PopoverOption[] => [
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

    return (
        <section className="surface-glass-card rounded-[24px] p-5">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                    <h2 className="text-lg font-black text-[var(--text-main)]">{text.list_title}</h2>
                    <p className="text-sm text-[var(--text-muted)]">{text.list_subtitle}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <label className="relative block w-full sm:w-auto">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                        <input
                            value={search}
                            onChange={(event) => onSearchChange(event.target.value)}
                            aria-label={text.search}
                            className="expense-input w-full !pl-11 sm:min-w-64"
                            placeholder={text.search}
                        />
                    </label>
                    <select
                        value={categoryFilter}
                        onChange={(event) => onCategoryFilterChange(event.target.value)}
                        aria-label={text.all_categories}
                        className="expense-input"
                    >
                        <option value="">{text.all_categories}</option>
                        {CATEGORY_OPTIONS.map((category) => (
                            <option key={category} value={category}>
                                {text.categories[category as keyof typeof text.categories] || category}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="hidden rounded-2xl lg:block">
                <div className="grid grid-cols-[5.5rem_minmax(16rem,2fr)_minmax(10rem,1fr)_minmax(8rem,0.85fr)_7rem_7rem_7rem_2.25rem] gap-2 rounded-t-2xl bg-[var(--bg-secondary)] px-3 py-3 text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                    <span>{text.date}</span>
                    <span>{text.description}</span>
                    <span>{text.vendor}</span>
                    <span>{text.category}</span>
                    <span className="text-center">{text.base_short}</span>
                    <span className="text-center">{text.tax_short}</span>
                    <span className="text-right">{text.total}</span>
                    <span className="sr-only">{text.actions}</span>
                </div>
                <div className="divide-y divide-[var(--border-soft)]">
                    {expenses.map((expense) => (
                        <div
                            key={expense.id}
                            className="grid grid-cols-[5.5rem_minmax(16rem,2fr)_minmax(10rem,1fr)_minmax(8rem,0.85fr)_7rem_7rem_7rem_2.25rem] items-center gap-2 px-3 py-3 text-left text-sm transition-colors hover:bg-[var(--bg-secondary)]/22"
                        >
                            <span className="font-semibold text-[var(--text-main)]">{formatExpenseDate(expense.expense_date)}</span>
                            <span className="flex min-w-0 items-center gap-2">
                                <span className="truncate font-black text-[var(--text-main)]">{expense.description}</span>
                                <ExpenseNotesTooltip label={text.notes} notes={getExpenseNotes(expense)} />
                            </span>
                            <span className="min-w-0 truncate text-[var(--text-muted)]">{expense.vendor || text.no_vendor}</span>
                            <span className="min-w-0">
                                <span className="inline-flex max-w-full rounded-full border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-2.5 py-1 text-xs font-black text-[var(--text-main)]">
                                    <span className="truncate">{text.categories[expense.category as keyof typeof text.categories] || expense.category}</span>
                                </span>
                            </span>
                            <span className="text-right font-semibold text-[var(--text-muted)]">{formatCurrency(expense.base_amount)}</span>
                            <span className="text-right font-semibold text-[var(--text-muted)]">{formatCurrency(expense.tax_amount)}</span>
                            <span className="text-right font-black text-[var(--text-main)]">{formatCurrency(expense.total_amount)}</span>
                            <span className="flex justify-end">
                                <ActionPopover options={getExpenseActions(expense)} />
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="grid gap-3 lg:hidden">
                {expenses.map((expense) => (
                    <div
                        key={expense.id}
                        className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)]/55 p-4 text-left"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate font-black text-[var(--text-main)]">{expense.description}</p>
                                <div className="mt-1 flex min-w-0 items-center gap-2">
                                    <p className="truncate text-xs text-[var(--text-muted)]">{expense.vendor || text.no_vendor}</p>
                                    <ExpenseNotesTooltip label={text.notes} notes={getExpenseNotes(expense)} />
                                </div>
                            </div>
                            <div className="flex shrink-0 items-start gap-2">
                                <span className="text-sm font-black text-[var(--text-main)]">{formatCurrency(expense.total_amount)}</span>
                                <ActionPopover options={getExpenseActions(expense)} />
                            </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--text-muted)]">
                            <span>{formatExpenseDate(expense.expense_date)}</span>
                            <span className="text-right">{text.categories[expense.category as keyof typeof text.categories] || expense.category}</span>
                            <span>{text.base_short}: {formatCurrency(expense.base_amount)}</span>
                            <span className="text-right">{text.tax_short}: {formatCurrency(expense.tax_amount)}</span>
                        </div>
                    </div>
                ))}
            </div>

            {expenses.length === 0 && (
                <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--bg-secondary)] p-8 text-center text-sm text-[var(--text-muted)]">
                    {text.empty}
                </div>
            )}
        </section>
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
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--btn-secondary-border)] bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] transition hover:bg-[var(--btn-secondary-hover-bg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-color)]"
            >
                <StickyNote className="h-3.5 w-3.5" />
            </button>
            <span className="pointer-events-none absolute bottom-full left-0 z-[10090] mb-2 hidden w-72 max-w-[70vw] rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-3 text-left text-xs font-semibold leading-relaxed text-[var(--text-main)] shadow-xl group-hover/note:block group-focus-within/note:block">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-[var(--text-muted)]">
                    {label}
                </span>
                <span className="block max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                    {notes}
                </span>
            </span>
        </span>
    );
}
