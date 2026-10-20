"use client";

import { Loader2 } from "lucide-react";
import { redirect } from "next/navigation";

import { InvoiceCreateSheet } from "@/components/invoices/InvoiceCreateSheet";
import { InvoiceDetailView } from "@/components/invoices/InvoiceDetailView";
import { InvoicesPageHeader } from "@/components/invoices/InvoicesPageHeader";
import { InvoicesStatsCards } from "@/components/invoices/InvoicesStatsCards";
import { InvoicesTabPanels } from "@/components/invoices/InvoicesTabPanels";
import { useInvoicesWorkspace } from "@/components/invoices/use-invoices-workspace";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

type InvoiceDetailDialogProps = {
    invoiceId: number | null
    initialEdit: boolean
    onClose: () => void
    onInvoiceChanged: () => void
}

function InvoiceDetailDialog({ invoiceId, initialEdit, onClose, onInvoiceChanged }: InvoiceDetailDialogProps) {
    return (
        <Dialog open={invoiceId !== null} onOpenChange={(open) => {
            if (!open) onClose()
        }}>
            <DialogContent className="flex h-[min(94vh,calc(100%-1rem))] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl lg:max-w-7xl">
                <DialogTitle className="sr-only">Detalle de factura</DialogTitle>
                {invoiceId !== null && (
                    <InvoiceDetailView
                        invoiceId={invoiceId}
                        initialEdit={initialEdit}
                        embedded
                        onChanged={onInvoiceChanged}
                    />
                )}
            </DialogContent>
        </Dialog>
    )
}

export default function InvoicesPage() {
    const workspace = useInvoicesWorkspace();
    const {
        activeView, clients, collaboratorOptions, createSheet, dict, filteredInvoiceableTasks,
        getClientName, getStatusText, handleJobFilterChange, handleToggleJob, invoiceSearch,
        invoiceStats, canManageInvoices, canViewInvoices, jobDateFrom, jobDateTo, jobInvoiceFilter, jobPartyFilter, jobSearch,
        loadInvoiceableTasks, loadInvoices, loading, loadingJobs, month, openCreateSheet, openInvoice, closeInvoice,
        previousInvoiceStats, resetCreateForm, resetInvoiceFilters, selectedClientId, selectedInvoiceId, selectedInvoiceIntent,
        selectedJobIds, selectedJobs, selectedJobsClientId, selectedStatus, setActiveView,
        setCreateSheet, setInvoiceSearch, setJobDateFrom, setJobDateTo, setJobInvoiceFilter,
        setJobPartyFilter, setJobSearch, setMonth, setSelectedClientId,
        setSelectedJobIds, setSelectedStatus, statusCounts, user, userLoading, visibleInvoices,
    } = workspace;

    if (!userLoading && (!user || !canViewInvoices)) redirect("/dashboard");

    if (userLoading || (activeView === "invoices" && loading)) {
        return (
            <div className="flex min-h-[400px] flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
                <span className="text-xs text-[var(--text-muted)]">{dict.dashboard.invoices_loading}</span>
            </div>
        );
    }
    if (!user || !canViewInvoices) return null;

    return (
        <div className="dashboard-page-content px-3 py-4 sm:px-5 lg:px-7">
            <div className="mx-auto max-w-[90rem] space-y-5">
                <InvoicesPageHeader title={dict.invoices.list_title} subtitle={dict.invoices.list_subtitle} newInvoiceLabel={dict.invoices.new_invoice} onCreateInvoice={() => openCreateSheet()} canManage={canManageInvoices} />

                {activeView === "invoices" ? <InvoicesStatsCards stats={invoiceStats} previousStats={previousInvoiceStats} statusCounts={statusCounts} labels={dict.invoices} /> : null}

                <InvoicesTabPanels
                    activeView={activeView}
                    onActiveViewChange={setActiveView}
                    tabLabels={dict.invoices}
                    canManage={canManageInvoices}
                    filtersProps={{
                        search: invoiceSearch,
                        onSearchChange: setInvoiceSearch,
                        selectedClientId,
                        onClientChange: setSelectedClientId,
                        selectedStatus,
                        onStatusChange: setSelectedStatus,
                        month,
                        onMonthChange: setMonth,
                        monthLabel: dict.invoices.month,
                        onReset: resetInvoiceFilters,
                        clients,
                        labels: dict.invoices,
                    }}
                    jobsProps={{
                        tasks: filteredInvoiceableTasks,
                        loading: loadingJobs,
                        selectedJobIds,
                        clients,
                        collaboratorOptions,
                        search: jobSearch,
                        onSearchChange: setJobSearch,
                        partyFilter: jobPartyFilter,
                        onPartyFilterChange: (value: string) => handleJobFilterChange(setJobPartyFilter, value),
                        invoiceFilter: jobInvoiceFilter,
                        onInvoiceFilterChange: (value: "all" | "pending" | "invoiced") => handleJobFilterChange(setJobInvoiceFilter, value),
                        dateFrom: jobDateFrom,
                        onDateFromChange: setJobDateFrom,
                        dateTo: jobDateTo,
                        onDateToChange: setJobDateTo,
                        onToggleJob: handleToggleJob,
                        onCreateInvoice: () => {
                            if (selectedJobs.length === 0 || !selectedJobsClientId) return;
                            openCreateSheet({ clientId: selectedJobsClientId.toString(), taskIds: selectedJobIds, tasks: selectedJobs });
                        },
                        labels: {
                            ...dict.invoices,
                            jobs_loading: dict.dashboard.jobs_loading,
                            task_title: dict.tasks.task_title,
                            location_label: dict.tasks.dialog.location_label,
                            col_date: dict.quotes.col_date,
                            invoiced: dict.locations.sheet.invoiced,
                            status_pending: dict.clients.details.status_pending,
                        },
                    }}
                    listProps={{
                        invoices: visibleInvoices,
                        loading,
                        loadingLabel: dict.dashboard.invoices_loading,
                        emptyLabel: dict.invoices.empty,
                        getClientName,
                        getStatusText,
                        onOpenInvoice: openInvoice,
                        canManage: canManageInvoices,
                        labels: dict.invoices,
                    }}
                />

                {canManageInvoices && <InvoiceCreateSheet
                    key={createSheet.dialogKey}
                    open={createSheet.open}
                    onOpenChange={(open) => {
                        if (!open) {
                            resetCreateForm();
                            return;
                        }
                        setCreateSheet((current) => ({ ...current, open: true }));
                    }}
                    onInvoiceCreated={() => {
                        void loadInvoices();
                        void loadInvoiceableTasks({ silent: true });
                        setSelectedJobIds([]);
                    }}
                    initialClientId={createSheet.clientId}
                    initialTaskIds={createSheet.taskIds}
                    initialTasks={createSheet.tasks}
                />}

                <InvoiceDetailDialog
                    invoiceId={selectedInvoiceId}
                    initialEdit={selectedInvoiceIntent === "edit"}
                    onClose={() => {
                        closeInvoice()
                        void loadInvoices()
                    }}
                    onInvoiceChanged={() => void loadInvoices()}
                />
            </div>
        </div>
    );
}
