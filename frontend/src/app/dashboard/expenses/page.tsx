"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useState, type FormEvent } from "react";
import { Loader2, Plus, Wallet } from "lucide-react";

import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { ExpenseSummaryCards } from "@/components/expenses/ExpenseSummaryCards";
import { ExpensesListSection } from "@/components/expenses/ExpensesListSection";
import { PageHeader } from "@/components/ui/page-header";
import { canAdministerCompany, isPlatformSuperadmin } from "@/domain/access/roles";
import { useDictionary } from "@/lib/dictionary-context";
import {
    buildExpensePayload,
    DEFAULT_EXPENSE_FORM,
    expenseToFormState,
    filterExpenses,
    type ExpenseFormState,
} from "@/lib/expense-form";
import { useUser } from "@/lib/user-context";
import { ExpenseService } from "@/services/expense.service";
import type { Expense, ExpensePayload } from "@/types/expense";
import { toast } from "@/lib/toast";

export default function ExpensesPage() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const canViewExpenses = canAdministerCompany(user) && !isPlatformSuperadmin(user);
    const text = dict.expenses;

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [keepAdding, setKeepAdding] = useState(true);
    const [form, setForm] = useState<ExpenseFormState>(DEFAULT_EXPENSE_FORM);

    const loadExpenses = useCallback(async () => {
        if (!canViewExpenses) return;
        try {
            setLoading(true);
            setExpenses(await ExpenseService.getExpenses({ limit: 250 }));
        } catch (error) {
            console.error("Error loading expenses", error);
            toast.error(text.error_load);
        } finally {
            setLoading(false);
        }
    }, [canViewExpenses, text.error_load]);

    const loadExpensesEvent = useEffectEvent(loadExpenses);

    useEffect(() => {
        if (userLoading) return;
        queueMicrotask(() => {
            void loadExpensesEvent();
        });
    }, [userLoading]);

    const totals = useMemo(() => {
        return expenses.reduce(
            (acc, expense) => ({
                base: acc.base + expense.base_amount,
                tax: acc.tax + expense.tax_amount,
                total: acc.total + expense.total_amount,
            }),
            { base: 0, tax: 0, total: 0 },
        );
    }, [expenses]);

    const filteredExpenses = useMemo(() => {
        return filterExpenses(expenses, search, categoryFilter);
    }, [categoryFilter, expenses, search]);

    const resetForm = () => {
        setEditingExpense(null);
        setForm(DEFAULT_EXPENSE_FORM);
    };

    const openCreateForm = () => {
        setEditingExpense(null);
        setForm(DEFAULT_EXPENSE_FORM);
        setKeepAdding(true);
        setIsFormOpen(true);
    };

    const startEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setKeepAdding(false);
        setForm(expenseToFormState(expense));
        setIsFormOpen(true);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!form.expense_date || !form.description.trim()) return;
        try {
            setSaving(true);
            const payload: ExpensePayload = buildExpensePayload(form);
            if (editingExpense) {
                await ExpenseService.updateExpense(editingExpense.id, payload);
                toast.success(text.updated);
                setIsFormOpen(false);
                resetForm();
            } else {
                await ExpenseService.createExpense(payload);
                toast.success(text.created);
                if (keepAdding) {
                    setForm(DEFAULT_EXPENSE_FORM);
                } else {
                    setIsFormOpen(false);
                    resetForm();
                }
            }
            await loadExpenses();
        } catch (error) {
            console.error("Error saving expense", error);
            toast.error(text.error_save);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (expense: Expense) => {
        if (!window.confirm(text.confirm_delete)) return;
        try {
            await ExpenseService.deleteExpense(expense.id);
            toast.success(text.deleted);
            await loadExpenses();
        } catch (error) {
            console.error("Error deleting expense", error);
            toast.error(text.error_delete);
        }
    };

    if (userLoading || loading) {
        return (
            <div className="flex h-full items-center justify-center gap-3 text-[var(--text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="text-sm font-semibold">{text.loading}</span>
            </div>
        );
    }

    if (!canViewExpenses) {
        return (
            <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-6">
                <p className="text-lg font-black text-[var(--text-main)]">{text.restricted_title}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{text.restricted_desc}</p>
            </div>
        );
    }

    return (
        <div className="min-h-full px-3 py-4 sm:px-5 lg:px-7">
            <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-5">
                <PageHeader
                    icon={Wallet}
                    title={text.title}
                    subtitle={text.subtitle}
                    actions={(
                        <button
                            type="button"
                            onClick={openCreateForm}
                            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--btn-primary-bg)] px-4 text-sm font-semibold text-[var(--btn-primary-text)] transition hover:bg-[var(--btn-primary-hover-bg)]"
                        >
                            <Plus className="h-4 w-4" />
                            {text.add_expense}
                        </button>
                    )}
                />
                <ExpenseSummaryCards total={totals.total} tax={totals.tax} records={expenses.length} />

                <ExpensesListSection
                    expenses={filteredExpenses}
                    search={search}
                    onSearchChange={setSearch}
                    categoryFilter={categoryFilter}
                    onCategoryFilterChange={setCategoryFilter}
                    onEdit={startEdit}
                    onDelete={(expense) => void handleDelete(expense)}
                />

                <ExpenseFormDialog
                    open={isFormOpen}
                    onOpenChange={(open) => {
                        setIsFormOpen(open);
                        if (!open) resetForm();
                    }}
                    editing={Boolean(editingExpense)}
                    form={form}
                    setForm={setForm}
                    keepAdding={keepAdding}
                    setKeepAdding={setKeepAdding}
                    saving={saving}
                    onSubmit={(event) => void handleSubmit(event)}
                />
            </div>
        </div>
    );
}
