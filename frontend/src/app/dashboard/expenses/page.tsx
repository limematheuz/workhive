"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2, Plus, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { ExpenseSummaryCards } from "@/components/expenses/ExpenseSummaryCards";
import { ExpensesListSection } from "@/components/expenses/ExpensesListSection";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { canManageFinance, canViewFinance, isPlatformSuperadmin } from "@/domain/access/roles";
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
import { ClientService } from "@/services/client.service";
import { ServiceContractService } from "@/services/service-contract.service";
import { WorkOrderService } from "@/services/work-order.service";
import type { Client } from "@/types/client";
import type { ServiceContract } from "@/types/service-contract";
import type { WorkOrder } from "@/types/work-order";
import type { Expense, ExpensePayload } from "@/types/expense";
import { toast } from "@/lib/toast";
import { getMonthKey, getPreviousMonthKey } from "@/lib/metric-trend";
import { getExpenseComparisonRange } from "@/lib/expense-period";

function summarizeExpenses(expenses: Expense[]) {
    return expenses.reduce(
        (acc, expense) => ({
            tax: acc.tax + expense.tax_amount,
            total: acc.total + expense.total_amount,
        }),
        { tax: 0, total: 0 },
    );
}

export default function ExpensesPage() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const canViewExpenses = canViewFinance(user) && !isPlatformSuperadmin(user);
    const canManageExpenses = canManageFinance(user) && !isPlatformSuperadmin(user);
    const text = dict.expenses;

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [contracts, setContracts] = useState<ServiceContract[]>([]);
    const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [month, setMonth] = useState(() => getMonthKey(new Date()) ?? "");
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [keepAdding, setKeepAdding] = useState(true);
    const [form, setForm] = useState<ExpenseFormState>(DEFAULT_EXPENSE_FORM);
    const loadRequestRef = useRef(0);

    const loadExpenses = useCallback(async () => {
        if (!canViewExpenses) return;
        const requestId = ++loadRequestRef.current;
        try {
            setLoading(true);
            const [expenseResult, clientResult, contractResult, workOrderResult] = await Promise.allSettled([
                ExpenseService.getAllExpenses(getExpenseComparisonRange(month)),
                ClientService.getClients(null),
                ServiceContractService.getContracts(),
                WorkOrderService.getWorkOrders(),
            ]);
            if (requestId !== loadRequestRef.current) return;
            if (expenseResult.status === "rejected") {
                throw expenseResult.reason;
            }
            setExpenses(expenseResult.value);
            if (clientResult.status === "fulfilled") {
                setClients(clientResult.value);
            } else {
                // Client attribution is optional. Keep expense operations available
                // when the supporting catalog is temporarily unavailable.
                console.error("Error loading expense client catalog", clientResult.reason);
                setClients([]);
            }
            setContracts(contractResult.status === "fulfilled" ? contractResult.value : []);
            setWorkOrders(workOrderResult.status === "fulfilled" ? workOrderResult.value : []);
        } catch (error) {
            if (requestId === loadRequestRef.current) {
                console.error("Error loading expenses", error);
                toast.error(text.error_load);
            }
        } finally {
            setLoading((current) => requestId === loadRequestRef.current ? false : current);
        }
    }, [canViewExpenses, month, text.error_load]);

    const loadExpensesEvent = useEffectEvent(loadExpenses);

    useEffect(() => {
        if (userLoading) return;
        queueMicrotask(() => {
            void loadExpensesEvent();
        });
    }, [userLoading, month]);

    const filteredExpenses = useMemo(() => {
        return filterExpenses(expenses.filter((expense) => getMonthKey(expense.expense_date) === month), search, categoryFilter);
    }, [categoryFilter, expenses, month, search]);
    const previousMonthExpenses = useMemo(() => {
        const previousMonth = getPreviousMonthKey(month);
        if (!previousMonth) return [];
        return filterExpenses(expenses.filter((expense) => getMonthKey(expense.expense_date) === previousMonth), search, categoryFilter);
    }, [categoryFilter, expenses, month, search]);
    const totals = useMemo(() => summarizeExpenses(filteredExpenses), [filteredExpenses]);
    const previousTotals = useMemo(() => summarizeExpenses(previousMonthExpenses), [previousMonthExpenses]);

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

    if (!userLoading && !canViewExpenses) redirect("/dashboard");

    if (userLoading || loading) {
        return (
            <div className="flex h-full items-center justify-center gap-3 text-[var(--text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="text-sm font-semibold">{text.loading}</span>
            </div>
        );
    }

    if (!canViewExpenses) return null;

    return (
        <div className="min-h-full px-3 py-4 sm:px-5 lg:px-7">
            <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-5">
                <PageHeader
                    icon={Wallet}
                    title={text.title}
                    subtitle={text.subtitle}
                    actions={canManageExpenses ? (
                        <Button
                            type="button"
                            onClick={openCreateForm}
                            className={PAGE_ACTION_BUTTON_PRIMARY}
                        >
                            <Plus className="h-4 w-4" />
                            {text.add_expense}
                        </Button>
                    ) : undefined}
                />
                <ExpenseSummaryCards total={totals.total} tax={totals.tax} records={filteredExpenses.length} previous={previousTotals} />

                <ExpensesListSection
                    expenses={filteredExpenses}
                    hasAnyExpenses={expenses.length > 0}
                    search={search}
                    onSearchChange={setSearch}
                    categoryFilter={categoryFilter}
                    onCategoryFilterChange={setCategoryFilter}
                    month={month}
                    onMonthChange={setMonth}
                    onEdit={startEdit}
                    onDelete={(expense) => void handleDelete(expense)}
                    canManage={canManageExpenses}
                />

                {canManageExpenses && <ExpenseFormDialog
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
                    clients={clients}
                    contracts={contracts}
                    workOrders={workOrders}
                    onSubmit={(event) => void handleSubmit(event)}
                />}
            </div>
        </div>
    );
}
