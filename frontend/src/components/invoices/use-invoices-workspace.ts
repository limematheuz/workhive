"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";

import { type InvoiceableTask } from "@/components/invoices/InvoiceableJobsSection";
import {
    computeStatusCounts,
    filterInvoiceableTasks,
    filterVisibleInvoices,
    getCollaboratorOptions,
    mapCompletedJobsToTasks,
    mergeClientsIfChanged,
    mergeInvoiceableTasksIfChanged,
} from "@/components/invoices/invoice-page-utils";
import { getInvoiceStatusText } from "@/components/invoices/invoice-status-utils";
import { computeInvoiceStats } from "@/components/invoices/invoice-stats";
import { useDictionary } from "@/lib/dictionary-context";
import { getMonthKey, getPreviousMonthKey } from "@/lib/metric-trend";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { canManageFinance, canViewFinance } from "@/domain/access/roles";
import { ClientService, type Client } from "@/services/client.service";
import { InvoiceService } from "@/services/invoice.service";
import type { Invoice } from "@/types/invoice";

type CreateSheetState = {
    open: boolean;
    clientId?: string;
    taskIds: number[];
    tasks: InvoiceableTask[];
    dialogKey: number;
};

const EMPTY_CREATE_SHEET: CreateSheetState = {
    open: false,
    clientId: undefined,
    taskIds: [],
    tasks: [],
    dialogKey: 0,
};

export function useInvoicesWorkspace() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedStatus, setSelectedStatus] = useState("");
    const [selectedClientId, setSelectedClientId] = useState("");
    const [invoiceSearch, setInvoiceSearch] = useState("");
    const [month, setMonth] = useState(() => getMonthKey(new Date()) ?? "");
    const [createSheet, setCreateSheet] = useState<CreateSheetState>(EMPTY_CREATE_SHEET);
    const [activeView, setActiveView] = useState<"invoices" | "jobs">("invoices");
    const [invoiceableTasks, setInvoiceableTasks] = useState<InvoiceableTask[]>([]);
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
    const [jobPartyFilter, setJobPartyFilter] = useState("");
    const [jobInvoiceFilter, setJobInvoiceFilter] = useState<"all" | "pending" | "invoiced">("pending");
    const [jobSearch, setJobSearch] = useState("");
    const [jobDateFrom, setJobDateFrom] = useState("");
    const [jobDateTo, setJobDateTo] = useState("");
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
    const canViewInvoices = canViewFinance(user);
    const canManageInvoices = canManageFinance(user);

    const loadInvoices = useCallback(async () => {
        if (userLoading || !user || !canViewInvoices) return;
        try {
            setLoading(true);
            const [data, clientsData] = await Promise.all([
                InvoiceService.getInvoices({
                    clientId: selectedClientId ? Number.parseInt(selectedClientId, 10) : undefined,
                    status: selectedStatus || undefined,
                }),
                clients.length === 0 ? ClientService.getClients() : Promise.resolve(null),
            ]);
            setInvoices(data);
            if (clientsData) setClients(clientsData);
        } catch (error) {
            console.error("Error loading invoices", error);
            toast.error(dict.invoices.error_load);
        } finally {
            setLoading(false);
        }
    }, [canViewInvoices, clients.length, dict.invoices.error_load, selectedClientId, selectedStatus, user, userLoading]);

    useEffect(() => {
        if (userLoading || !user || !canViewInvoices) return;
        startTransition(() => void loadInvoices());
    }, [canViewInvoices, loadInvoices, user, userLoading]);

    const jobsLoadedRef = useRef(false);
    const loadInvoiceableTasks = useCallback(async (options?: { silent?: boolean }) => {
        if (userLoading || !user || !canManageInvoices) return;
        const showLoader = !options?.silent && !jobsLoadedRef.current;
        try {
            if (showLoader) setLoadingJobs(true);
            const jobs = await InvoiceService.getCompletedJobs();
            const refreshedClients = await ClientService.getClients(true).catch(() => null);
            if (refreshedClients) setClients((previous) => mergeClientsIfChanged(previous, refreshedClients));
            setInvoiceableTasks((previous) => mergeInvoiceableTasksIfChanged(previous, mapCompletedJobsToTasks(jobs)));
            jobsLoadedRef.current = true;
        } catch (error) {
            console.error("Error loading completed jobs", error);
            toast.error(dict.invoices.error_load);
        } finally {
            setLoadingJobs(false);
        }
    }, [canManageInvoices, dict.invoices.error_load, user, userLoading]);

    useEffect(() => {
        if (activeView !== "jobs" || userLoading || !user || !canManageInvoices) return;
        startTransition(() => void loadInvoiceableTasks());
    }, [activeView, canManageInvoices, loadInvoiceableTasks, user, userLoading]);

    const getClientName = (clientId: number) => clients.find((client) => client.id === clientId)?.name || `Client ID: ${clientId}`;
    const getStatusText = (status: Invoice["status"]) => getInvoiceStatusText(status, dict.invoices);
    const invoicesForMonth = invoices.filter((invoice) => getMonthKey(invoice.issue_date) === month);
    const previousMonth = getPreviousMonthKey(month);
    const previousInvoicesForMonth = previousMonth
        ? invoices.filter((invoice) => getMonthKey(invoice.issue_date) === previousMonth)
        : [];
    const visibleInvoices = filterVisibleInvoices(invoicesForMonth, invoiceSearch, getClientName, dict.invoices);
    const previousVisibleInvoices = filterVisibleInvoices(previousInvoicesForMonth, invoiceSearch, getClientName, dict.invoices);
    const invoiceStats = computeInvoiceStats(visibleInvoices);
    const previousInvoiceStats = computeInvoiceStats(previousVisibleInvoices);
    const statusCounts = computeStatusCounts(visibleInvoices);
    const filteredInvoiceableTasks = filterInvoiceableTasks(invoiceableTasks, {
        partyFilter: jobPartyFilter,
        invoiceFilter: jobInvoiceFilter,
        search: jobSearch,
        dateFrom: jobDateFrom,
        dateTo: jobDateTo,
    });
    const collaboratorOptions = getCollaboratorOptions(invoiceableTasks);
    const selectedJobIdSet = new Set(selectedJobIds);
    const selectedJobs = invoiceableTasks.filter((task) => selectedJobIdSet.has(task.id));
    const selectedJobsClientId = selectedJobs[0]?.clientId;

    const resetCreateForm = () => setCreateSheet((current) => ({ ...current, open: false, clientId: undefined, taskIds: [], tasks: [] }));
    const openCreateSheet = (payload?: { clientId?: string; taskIds?: number[]; tasks?: InvoiceableTask[] }) => {
        setCreateSheet((current) => ({
            open: true,
            clientId: payload?.clientId,
            taskIds: payload?.taskIds ?? [],
            tasks: payload?.tasks ?? [],
            dialogKey: current.dialogKey + 1,
        }));
    };
    const handleToggleJob = (task: InvoiceableTask) => {
        if (task.is_invoiced) return;
        if (selectedJobs.length > 0 && selectedJobsClientId !== task.clientId) {
            setSelectedJobIds([task.id]);
            toast.info("Selection changed to this job's client.");
            return;
        }
        setSelectedJobIds((previous) => previous.includes(task.id) ? previous.filter((id) => id !== task.id) : [...previous, task.id]);
    };
    const handleJobFilterChange = <T,>(setter: (value: T) => void, value: T) => {
        setter(value);
        setSelectedJobIds([]);
    };
    const resetInvoiceFilters = () => {
        setInvoiceSearch("");
        setSelectedClientId("");
        setSelectedStatus("");
        setMonth(getMonthKey(new Date()) ?? "");
    };

    return {
        activeView,
        clients,
        collaboratorOptions,
        createSheet,
        dict,
        filteredInvoiceableTasks,
        getClientName,
        getStatusText,
        handleJobFilterChange,
        handleToggleJob,
        invoiceSearch,
        invoiceStats,
        invoiceableTasks,
        canManageInvoices,
        canViewInvoices,
        jobDateFrom,
        jobDateTo,
        jobInvoiceFilter,
        jobPartyFilter,
        jobSearch,
        loadInvoiceableTasks,
        loadInvoices,
        loading,
        loadingJobs,
        month,
        openCreateSheet,
        previousInvoiceStats,
        resetCreateForm,
        resetInvoiceFilters,
        selectedInvoiceId,
        selectedClientId,
        selectedJobIds,
        selectedJobs,
        selectedJobsClientId,
        selectedStatus,
        setActiveView,
        setCreateSheet,
        setInvoiceSearch,
        setJobDateFrom,
        setJobDateTo,
        setJobInvoiceFilter,
        setJobPartyFilter,
        setJobSearch,
        setMonth,
        setSelectedClientId,
        setSelectedInvoiceId,
        setSelectedJobIds,
        setSelectedStatus,
        statusCounts,
        user,
        userLoading,
        visibleInvoices,
    };
}
