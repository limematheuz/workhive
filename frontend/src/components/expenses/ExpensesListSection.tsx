"use client";

import { Download, FileUp, Pencil, Receipt, Search, StickyNote, Trash2 } from "lucide-react";

import { ActionPopover, type PopoverOption } from "@/components/ui/action-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDictionary } from "@/lib/dictionary-context";
import { formatExpenseDate, getExpenseNotes } from "@/lib/expense-form";
import { isPrivateExpenseReceipt } from "@/lib/expense-receipt";
import { formatCurrency } from "@/lib/format";
import type { Expense } from "@/types/expense";
import { CATEGORY_OPTIONS } from "./expense-options";

type ExpensesListSectionProps = {
    expenses: Expense[];
    hasAnyExpenses: boolean;
    search: string;
    onSearchChange: (value: string) => void;
    categoryFilter: string;
    onCategoryFilterChange: (value: string) => void;
    month: string;
    onMonthChange: (value: string) => void;
    onEdit: (expense: Expense) => void;
    onDelete: (expense: Expense) => void;
    onUploadReceipt: (expense: Expense) => void;
    onDownloadReceipt: (expense: Expense) => void;
    canManage: boolean;
};

export function ExpensesListSection({
    expenses,
    hasAnyExpenses,
    search,
    onSearchChange,
    categoryFilter,
    onCategoryFilterChange,
    month,
    onMonthChange,
    onEdit,
    onDelete,
    onUploadReceipt,
    onDownloadReceipt,
    canManage,
}: ExpensesListSectionProps) {
    const { dict } = useDictionary();
    const text = dict.expenses;

    const getExpenseActions = (expense: Expense): PopoverOption[] => {
        const actions: PopoverOption[] = [];
        if (isPrivateExpenseReceipt(expense.receipt_url)) {
            actions.push({
                label: text.receipt_download,
                icon: Download,
                onClick: () => onDownloadReceipt(expense),
            });
        } else if (!expense.receipt_url && canManage) {
            actions.push({
                label: text.receipt_upload,
                icon: FileUp,
                onClick: () => onUploadReceipt(expense),
            });
        }
        if (canManage) {
            actions.push(
                { label: text.edit, icon: Pencil, variant: "edit", onClick: () => onEdit(expense) },
                { label: text.delete, icon: Trash2, variant: "delete", onClick: () => onDelete(expense) },
            );
        }
        return actions;
    };
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
                <div className="mb-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_14rem_11rem]">
                    <label className="relative block min-w-0 sm:col-span-2 xl:col-span-1">
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
                    <label className="block min-w-0">
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
                    <label className="block min-w-0">
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
                { key: "date", label: text.date, className: "w-24" },
                { key: "description", label: text.description },
                { key: "amounts", label: <span className="block whitespace-normal">{text.base_short} / {text.tax_short}</span>, className: "w-32 text-right" },
                { key: "total", label: text.total, className: "w-32 text-right" },
                { key: "actions", label: <span className="sr-only">{text.actions}</span>, className: "w-16 overflow-visible" },
            ]}
            empty={(
                <>
                    <Receipt className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
                    <p className="mt-3 text-sm text-[var(--text-muted)]">{hasAnyExpenses ? text.empty_filtered : text.empty}</p>
                </>
            )}
            renderCompactRow={(expense) => (
                <>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="break-words font-semibold text-[var(--text-main)]">{expense.description}</p>
                            <div className="mt-1 flex min-w-0 items-start gap-2">
                                <p className="min-w-0 break-words text-xs text-[var(--text-muted)]">{expense.vendor || text.no_vendor}</p>
                                <ExpenseNotesTooltip label={text.notes} notes={getExpenseNotes(expense)} />
                            </div>
                            {operationalScopeLabel(expense) && <p className="mt-1 truncate text-xs font-medium text-accent">{operationalScopeLabel(expense)}</p>}
                        </div>
                        <div className="flex shrink-0 items-start gap-2">
                            <span className="text-sm font-semibold text-[var(--text-main)]">{formatCurrency(expense.total_amount)}</span>
                            {getExpenseActions(expense).length > 0 && <ActionPopover options={getExpenseActions(expense)} triggerLabel={text.actions} />}
                        </div>
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-[var(--border-soft)] pt-2.5 text-xs text-[var(--text-muted)]">
                        <span>{formatExpenseDate(expense.expense_date)}</span>
                        <Badge variant="secondary" className="ml-auto max-w-full whitespace-normal break-words text-right">{text.categories[expense.category as keyof typeof text.categories] || expense.category}</Badge>
                        <span>{text.base_short}: {formatCurrency(expense.base_amount)}</span>
                        <span className="text-right">{text.tax_short}: {formatCurrency(expense.tax_amount)}</span>
                    </div>
                </>
            )}
            renderDesktopRow={(expense) => (
                <>
                    <span className="text-sm font-semibold text-[var(--text-main)]">{formatExpenseDate(expense.expense_date)}</span>
                    <span className="flex min-w-0 items-start gap-2 whitespace-normal">
                        <span className="min-w-0 space-y-1">
                            <span className="block break-words font-semibold text-[var(--text-main)]">{expense.description}</span>
                            <span className="block break-words text-xs text-[var(--text-muted)]">{expense.vendor || text.no_vendor}</span>
                            <Badge variant="secondary" className="max-w-full whitespace-normal break-words">{text.categories[expense.category as keyof typeof text.categories] || expense.category}</Badge>
                            {operationalScopeLabel(expense) && <span className="block truncate text-xs font-medium text-accent">{operationalScopeLabel(expense)}</span>}
                        </span>
                        <ExpenseNotesTooltip label={text.notes} notes={getExpenseNotes(expense)} />
                    </span>
                    <span className="block space-y-1 text-right text-sm text-[var(--text-muted)]">
                        <span className="block font-semibold"><span className="sr-only">{text.base_short}: </span>{formatCurrency(expense.base_amount)}</span>
                        <span className="block text-xs">{text.tax_short}: {formatCurrency(expense.tax_amount)}</span>
                    </span>
                    <span className="text-right font-mono text-sm font-semibold text-[var(--text-main)]">{formatCurrency(expense.total_amount)}</span>
                    <span className="flex justify-end">
                        {getExpenseActions(expense).length > 0 && <ActionPopover options={getExpenseActions(expense)} triggerLabel={text.actions} />}
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
            <Button
                type="button"
                variant="secondary"
                size="icon-xs"
                title={notes}
                aria-label={`${label}: ${notes}`}
                onClick={(event) => event.stopPropagation()}
                className="h-7 w-7 rounded-full"
            >
                <StickyNote className="h-3.5 w-3.5" />
            </Button>
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
