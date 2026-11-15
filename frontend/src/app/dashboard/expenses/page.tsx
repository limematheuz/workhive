"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState, type FormEvent } from "react";
import { Loader2, Plus, Wallet } from "lucide-react";
import { redirect } from "next/navigation";

import { ExpenseFormDialog } from "@/components/expenses/ExpenseFormDialog";
import { ExpenseReceiptDialog } from "@/components/expenses/ExpenseReceiptDialog";
import { ExpenseSummaryCards } from "@/components/expenses/ExpenseSummaryCards";
import { ExpensesListSection } from "@/components/expenses/ExpensesListSection";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ReadRecoveryBanner } from "@/components/ui/read-recovery-banner";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeEvents";
import { PAGE_ACTION_BUTTON_PRIMARY } from "@/lib/page-action-button";
import { ApiResponseError } from "@/lib/api";
import { canManageFinance, canViewFinance, isPlatformSuperadmin } from "@/domain/access/roles";
import { useDictionary } from "@/lib/dictionary-context";
import {
    classifyReadError,
    getReadRecoveryMessage,
    getReadWorkspaceKey,
    type ReadErrorKind,
} from "@/lib/read-recovery";
import {
    buildExpensePayload,
    DEFAULT_EXPENSE_FORM,
    expenseToFormState,
    expenseDuplicateKey,
    findPotentialDuplicateExpense,
    filterExpenses,
    getExpenseSaveFeedback,
    type ExpenseFormState,
} from "@/lib/expense-form";
import { getExpenseReceiptFeedback, isExpectedReceiptRejection } from "@/lib/expense-receipt";
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
    const [errorKind, setErrorKind] = useState<ReadErrorKind | null>(null);
    const [hasLoadedAnyMonth, setHasLoadedAnyMonth] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [month, setMonth] = useState(() => getMonthKey(new Date()) ?? "");
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [keepAdding, setKeepAdding] = useState(true);
    const [form, setForm] = useState<ExpenseFormState>(DEFAULT_EXPENSE_FORM);
    const [receiptExpense, setReceiptExpense] = useState<Expense | null>(null);
    const [receiptUploading, setReceiptUploading] = useState(false);
    const [confirmedDuplicate, setConfirmedDuplicate] = useState<{ key: string; expense: Expense | null } | null>(null);
    const [loadedContext, setLoadedContext] = useState<string | null>(null);
    const loadRequestRef = useRef(0);
    const loadedContextRef = useRef<string | null>(null);
    const loadedWorkspaceRef = useRef<string | null>(null);
    const workspaceKey = getReadWorkspaceKey(user);
    const contextKey = `${workspaceKey}|${month}`;

    const loadExpenses = useCallback(async () => {
        if (!canViewExpenses) return;
        const requestId = ++loadRequestRef.current;
        const targetWorkspace = workspaceKey;
        const targetContext = `${targetWorkspace}|${month}`;
        if (loadedWorkspaceRef.current !== targetWorkspace) {
            setHasLoadedAnyMonth(false);
        }
        if (loadedContextRef.current !== targetContext) {
            setExpenses([]);
            setClients([]);
            setContracts([]);
            setWorkOrders([]);
            loadedContextRef.current = null;
            setLoadedContext(null);
        }
        try {
            setLoading(true);
            const [expenseResult, clientResult, contractResult, workOrderResult] = await Promise.allSettled([
                ExpenseService.getAllExpenses(getExpenseComparisonRange(month)),
                canManageExpenses ? ClientService.getClients(null) : Promise.resolve([]),
                canManageExpenses ? ServiceContractService.getContracts() : Promise.resolve([]),
                canManageExpenses ? WorkOrderService.getWorkOrders() : Promise.resolve([]),
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
            loadedWorkspaceRef.current = targetWorkspace;
            loadedContextRef.current = targetContext;
            setLoadedContext(targetContext);
            setHasLoadedAnyMonth(true);
            setErrorKind(null);
        } catch (error) {
            if (requestId === loadRequestRef.current) {
                console.error("Error loading expenses", error);
                const kind = classifyReadError(error);
                setErrorKind(kind);
                if (kind === "denied" || loadedContextRef.current !== targetContext) {
                    setExpenses([]);
                    setClients([]);
                    setContracts([]);
                    setWorkOrders([]);
                    loadedContextRef.current = null;
                    setLoadedContext(null);
                }
                if (kind === "denied") {
                    setHasLoadedAnyMonth(false);
                    loadedWorkspaceRef.current = null;
                }
                toast.error(kind === "denied" ? text.error_denied : text.error_load);
            }
        } finally {
            setLoading((current) => requestId === loadRequestRef.current ? false : current);
        }
    }, [canManageExpenses, canViewExpenses, month, text.error_denied, text.error_load, workspaceKey]);

    const loadExpensesEvent = useEffectEvent(loadExpenses);

    useEffect(() => {
        if (userLoading || !canViewExpenses) return;
        queueMicrotask(() => {
            void loadExpensesEvent();
        });
    }, [canViewExpenses, userLoading, month, workspaceKey]);

    useRealtimeInvalidation(["dashboard"], () => {
        void loadExpenses();
    });

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
        setConfirmedDuplicate(null);
    };

    const openCreateForm = () => {
        setEditingExpense(null);
        setForm(DEFAULT_EXPENSE_FORM);
        setConfirmedDuplicate(null);
        setKeepAdding(true);
        setIsFormOpen(true);
    };

    const startEdit = (expense: Expense) => {
        setEditingExpense(expense);
        setKeepAdding(false);
        setForm(expenseToFormState(expense));
        setConfirmedDuplicate(null);
        setIsFormOpen(true);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!form.expense_date || !form.description.trim()) return;
        try {
            setSaving(true);
            const payload: ExpensePayload = buildExpensePayload(form);
            const duplicateKey = expenseDuplicateKey(payload);
            if (!editingExpense && confirmedDuplicate?.key !== duplicateKey) {
                try {
                    const sameDay = await ExpenseService.getAllExpenses({
                        dateFrom: `${form.expense_date}T00:00:00`,
                        dateTo: `${form.expense_date}T23:59:59.999999`,
                    });
                    const duplicate = findPotentialDuplicateExpense(payload, sameDay);
                    if (duplicate) {
                        setConfirmedDuplicate({ key: duplicateKey, expense: duplicate });
                        return;
                    }
                } catch {
                    setConfirmedDuplicate({ key: duplicateKey, expense: null });
                    return;
                }
            }
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
                    setConfirmedDuplicate(null);
                } else {
                    setIsFormOpen(false);
                    resetForm();
                }
            }
            await loadExpenses();
        } catch (error) {
            if (!(error instanceof ApiResponseError && error.status < 500)) {
                console.error("Error saving expense", error);
            }
            toast.error(getExpenseSaveFeedback(error, text.error_save));
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

    const handleReceiptUpload = async (file: File) => {
        if (!receiptExpense) return;
        try {
            setReceiptUploading(true);
            await ExpenseService.uploadReceipt(receiptExpense.id, file);
            toast.success(text.receipt_uploaded);
            setReceiptExpense(null);
            await loadExpenses();
        } catch (error) {
            if (!isExpectedReceiptRejection(error)) {
                console.error("Error uploading expense receipt", error);
            }
            toast.error(getExpenseReceiptFeedback(error, text.receipt_upload_error));
        } finally {
            setReceiptUploading(false);
        }
    };

    const handleReceiptDownload = async (expense: Expense) => {
        try {
            const { blob, filename } = await ExpenseService.downloadReceipt(expense.id);
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            link.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading expense receipt", error);
            toast.error(text.receipt_download_error);
        }
    };

    if (!userLoading && !canViewExpenses) redirect("/dashboard");

    if (userLoading || (loading && !hasLoadedAnyMonth && !errorKind)) {
        return (
            <div className="flex h-full items-center justify-center gap-3 text-[var(--text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="text-sm font-semibold">{text.loading}</span>
            </div>
        );
    }

    if (!canViewExpenses) return null;

    const hasValidSnapshot = loadedContext === contextKey && errorKind !== "denied";
    const errorMessage = getReadRecoveryMessage(errorKind, {
        unavailable: text.error_load,
        denied: text.error_denied,
    });
    const showListSection = hasLoadedAnyMonth && errorKind !== "denied";

    return (
        <div className="min-h-full px-3 py-4 sm:px-5 lg:px-7">
            <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-5">
                <PageHeader
                    icon={Wallet}
                    title={text.title}
                    subtitle={canManageExpenses ? text.subtitle : text.readonly_subtitle}
                    actions={canManageExpenses && errorKind !== "denied" ? (
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

                {!showListSection && errorKind && errorMessage && (
                    <ReadRecoveryBanner
                        kind={errorKind}
                        message={errorMessage}
                        retryLabel={text.retry}
                        onRetry={errorKind === "unavailable" ? () => void loadExpenses() : undefined}
                        retrying={loading}
                    />
                )}

                {hasValidSnapshot && (
                    <ExpenseSummaryCards total={totals.total} tax={totals.tax} records={filteredExpenses.length} previous={previousTotals} />
                )}

                {showListSection && (
                    <ExpensesListSection
                        expenses={filteredExpenses}
                        hasAnyExpenses={expenses.length > 0}
                        search={search}
                        onSearchChange={setSearch}
                        categoryFilter={categoryFilter}
                        onCategoryFilterChange={setCategoryFilter}
                        month={month}
                        onMonthChange={(nextMonth) => {
                            if (nextMonth !== month) {
                                setExpenses([]);
                                setLoadedContext(null);
                                loadedContextRef.current = null;
                            }
                            setMonth(nextMonth);
                        }}
                        onEdit={startEdit}
                        onDelete={(expense) => void handleDelete(expense)}
                        onUploadReceipt={setReceiptExpense}
                        onDownloadReceipt={(expense) => void handleReceiptDownload(expense)}
                        canManage={canManageExpenses}
                        errorKind={errorKind}
                        errorMessage={errorMessage}
                        retryLabel={text.retry}
                        onRetry={errorKind === "unavailable" ? () => void loadExpenses() : undefined}
                        retrying={loading}
                    />
                )}

                {canManageExpenses && <ExpenseReceiptDialog
                    key={receiptExpense?.id ?? "none"}
                    expense={receiptExpense}
                    uploading={receiptUploading}
                    onClose={() => setReceiptExpense(null)}
                    onUpload={(file) => void handleReceiptUpload(file)}
                />}

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
                    potentialDuplicate={confirmedDuplicate?.key === expenseDuplicateKey(buildExpensePayload(form)) ? confirmedDuplicate.expense : null}
                    duplicateCheckUnavailable={confirmedDuplicate?.key === expenseDuplicateKey(buildExpensePayload(form)) && !confirmedDuplicate.expense}
                />}
            </div>
        </div>
    );
}
