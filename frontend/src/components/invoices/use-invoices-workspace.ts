"use client";

import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
import { useViewState } from "@/hooks/useViewState";
import { financeLocalDay, isInvoiceOverdue } from "@/lib/finance-priorities";
import { selectInvoiceAttention, type InvoiceAttention } from "@/lib/finance-workspace";

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
    const [loadError, setLoadError] = useState(false);
    const [attention, setAttention] = useViewState<InvoiceAttention>("invoices.attention", "all");
    const [selectedStatus, setSelectedStatus] = useViewState("invoices.status", "");
    const [selectedClientId, setSelectedClientId] = useViewState("invoices.client", "");
    const [invoiceSearch, setInvoiceSearch] = useViewState("invoices.search", "");
    const [month, setMonth] = useViewState("invoices.month", () => getMonthKey(new Date()) ?? "");
    const [createSheet, setCreateSheet] = useState<CreateSheetState>(EMPTY_CREATE_SHEET);
    const router=useRouter();
    const searchParams=useSearchParams();
    const queryState = searchParams.toString();
    useEffect(() => {
        const query = new URLSearchParams(queryState);
        startTransition(() => {
            const queryMonth = query.get("month");
            if (queryMonth !== null && (/^\d{4}-\d{2}$/.test(queryMonth) || queryMonth === "")) setMonth(queryMonth);
            if (query.has("client")) setSelectedClientId(query.get("client") ?? "");
            if (query.has("status")) setSelectedStatus(query.get("status") ?? "");
            if (query.has("search")) setInvoiceSearch(query.get("search") ?? "");
            const queryAttention = query.get("attention");
            if (queryAttention && ["all", "draft", "pending", "overdue"].includes(queryAttention)) setAttention(queryAttention as InvoiceAttention);
        });
    }, [queryState, setMonth, setSelectedClientId, setSelectedStatus, setInvoiceSearch, setAttention]);
    const [invoiceableTasks, setInvoiceableTasks] = useState<InvoiceableTask[]>([]);
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [selectedJobIds, setSelectedJobIds] = useState<number[]>([]);
    const [jobPartyFilter, setJobPartyFilter] = useViewState("invoices.jobs.party", "");
    const [jobInvoiceFilter, setJobInvoiceFilter] = useViewState<"all" | "pending" | "invoiced">("invoices.jobs.status", "pending");
    const [jobSearch, setJobSearch] = useViewState("invoices.jobs.search", "");
    const [jobDateFrom, setJobDateFrom] = useViewState("invoices.jobs.from", "");
    const [jobDateTo, setJobDateTo] = useViewState("invoices.jobs.to", "");
    useEffect(() => {
        const status = new URLSearchParams(queryState).get("jobStatus");
        if (status && ["all", "pending", "invoiced"].includes(status)) startTransition(() => setJobInvoiceFilter(status as "all" | "pending" | "invoiced"));
    }, [queryState, setJobInvoiceFilter]);
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(() => {
        const id = Number(searchParams.get("invoice"));
        return Number.isSafeInteger(id) && id > 0 ? id : null;
    });
    const [selectedInvoiceIntent, setSelectedInvoiceIntent] = useState<"view" | "edit">("view");
    const requestedInvoice = searchParams.get("invoice");
    useEffect(() => {
        const id = Number(requestedInvoice);
        if (Number.isSafeInteger(id) && id > 0) startTransition(() => { setSelectedInvoiceId(id); setSelectedInvoiceIntent("view"); });
    }, [requestedInvoice]);
    const openInvoice = (invoiceId: number, intent: "view" | "edit" = "view") => {
        setSelectedInvoiceId(invoiceId);
        setSelectedInvoiceIntent(intent);
    };
    const closeInvoice = () => {
        setSelectedInvoiceId(null);
        setSelectedInvoiceIntent("view");
        if (searchParams.has("invoice")) {
            const query = new URLSearchParams(searchParams.toString()); query.delete("invoice");
            router.replace(`/dashboard/invoices${query.size ? `?${query}` : ""}`, { scroll: false });
        }
    };
    const canViewInvoices = canViewFinance(user);
    const canManageInvoices = canManageFinance(user);
    const activeView: "invoices"|"jobs"=canManageInvoices&&searchParams.get("view")==="jobs"?"jobs":"invoices";
    const setActiveView=(view:"invoices"|"jobs")=>{
        const query=new URLSearchParams(searchParams.toString());query.set("view",view);
        router.replace("/dashboard/invoices?"+query.toString(),{scroll:false});
    };

    const loadInvoices = useCallback(async () => {
        if (userLoading || !user || !canViewInvoices) return;
        try {
            setLoading(true);
            setLoadError(false);
            const [data, clientsData] = await Promise.all([
                InvoiceService.getAllInvoices(),
                clients.length === 0 ? ClientService.getAllClients(null).catch(() => null) : Promise.resolve(null),
            ]);
            setInvoices(data);
            if (clientsData) setClients(clientsData);
        } catch (error) {
            setLoadError(true);
            console.error("Error loading invoices", error);
            toast.error(dict.invoices.error_load);
        } finally {
            setLoading(false);
        }
    }, [canViewInvoices, clients.length, dict.invoices.error_load, user, userLoading]);

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
            const refreshedClients = await ClientService.getAllClients(true).catch(() => null);
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
    const asOf = financeLocalDay(new Date());
    const filteredInvoices = invoices.filter((invoice) => (!selectedClientId || String(invoice.client_id) === selectedClientId) && (!selectedStatus || (selectedStatus === "overdue" ? isInvoiceOverdue(invoice, asOf) : invoice.status === selectedStatus)));
    const invoicesForMonth = filteredInvoices.filter((invoice) => !month || getMonthKey(invoice.issue_date) === month);
    const previousMonth = getPreviousMonthKey(month);
    const previousInvoicesForMonth = previousMonth
        ? filteredInvoices.filter((invoice) => getMonthKey(invoice.issue_date) === previousMonth)
        : [];
    const cohortInvoices = filterVisibleInvoices(invoicesForMonth, invoiceSearch, getClientName, dict.invoices);
    const visibleInvoices = selectInvoiceAttention(cohortInvoices, attention, asOf);
    const previousVisibleInvoices = filterVisibleInvoices(previousInvoicesForMonth, invoiceSearch, getClientName, dict.invoices);
    const invoiceStats = computeInvoiceStats(cohortInvoices, asOf);
    const previousInvoiceStats = computeInvoiceStats(previousVisibleInvoices);
    const statusCounts = computeStatusCounts(cohortInvoices);
    statusCounts.overdue = selectInvoiceAttention(cohortInvoices, "overdue", asOf).length;
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
        setAttention("all");
    };

    return {
        activeView,
        attention,
        setAttention,
        asOf,
        loadError,
        draftCount: cohortInvoices.filter((invoice) => invoice.status === "draft").length,
        recordCount: cohortInvoices.length,
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
        selectedInvoiceIntent,
        openInvoice,
        closeInvoice,
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
        setSelectedJobIds,
        setSelectedStatus,
        statusCounts,
        user,
        userLoading,
        visibleInvoices,
    };
}
