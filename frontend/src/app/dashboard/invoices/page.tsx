"use client";

import { startTransition, useState, useEffect, useCallback, useRef } from "react"
import { InvoiceService } from "@/services/invoice.service"
import { ClientService, Client } from "@/services/client.service"
import { Invoice } from "@/types/invoice"
import { InvoiceCreateSheet } from "@/components/invoices/InvoiceCreateSheet"
import { type InvoiceableTask } from "@/components/invoices/InvoiceableJobsSection"
import { InvoicesPageHeader } from "@/components/invoices/InvoicesPageHeader"
import { InvoicesStatsCards } from "@/components/invoices/InvoicesStatsCards"
import { InvoicesTabPanels } from "@/components/invoices/InvoicesTabPanels"
import {
    computeInvoiceStats,
    computeStatusCounts,
    filterInvoiceableTasks,
    filterVisibleInvoices,
    getCollaboratorOptions,
    isInvoicesAdmin,
    mapCompletedJobsToTasks,
    mergeClientsIfChanged,
    mergeInvoiceableTasksIfChanged,
} from "@/components/invoices/invoice-page-utils"
import { getInvoiceStatusText } from "@/components/invoices/invoice-status-utils"
import { InvoiceDetailView } from "@/components/invoices/InvoiceDetailView"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { useDictionary } from "@/lib/dictionary-context"
import { useUser } from "@/lib/user-context"
import { redirect } from "next/navigation"
import { toast } from "@/lib/toast"
import { Loader2 } from "lucide-react"

type CreateSheetState = {
    open: boolean
    clientId?: string
    taskIds: number[]
    tasks: InvoiceableTask[]
    dialogKey: number
}

const EMPTY_CREATE_SHEET: CreateSheetState = {
    open: false,
    clientId: undefined,
    taskIds: [],
    tasks: [],
    dialogKey: 0,
}

export default function InvoicesPage() {
    const { dict } = useDictionary()
    const { user, loading: userLoading } = useUser()

    const [invoices, setInvoices] = useState<Invoice[]>([])
    const [clients, setClients] = useState<Client[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [selectedStatus, setSelectedStatus] = useState<string>("")
    const [selectedClientId, setSelectedClientId] = useState<string>("")
    const [invoiceSearch, setInvoiceSearch] = useState<string>("")
    const [createSheet, setCreateSheet] = useState<CreateSheetState>(EMPTY_CREATE_SHEET)
    const [activeView, setActiveView] = useState<"invoices" | "jobs">("invoices")
    const [invoiceableTasks, setInvoiceableTasks] = useState<InvoiceableTask[]>([])
    const [loadingJobs, setLoadingJobs] = useState<boolean>(false)
    const [selectedJobIds, setSelectedJobIds] = useState<number[]>([])
    const [jobPartyFilter, setJobPartyFilter] = useState<string>("")
    const [jobInvoiceFilter, setJobInvoiceFilter] = useState<"all" | "pending" | "invoiced">("pending")
    const [jobSearch, setJobSearch] = useState<string>("")
    const [jobDateFrom, setJobDateFrom] = useState<string>("")
    const [jobDateTo, setJobDateTo] = useState<string>("")
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)

    const isAdmin = isInvoicesAdmin(user?.role?.name)

    if (!userLoading && (!user || !isAdmin)) {
        redirect("/dashboard")
    }

    const loadInvoices = useCallback(async () => {
        if (userLoading || !user || !isAdmin) return
        try {
            setLoading(true)
            const [data, clientsData] = await Promise.all([
                InvoiceService.getInvoices({
                    clientId: selectedClientId ? parseInt(selectedClientId, 10) : undefined,
                    status: selectedStatus || undefined,
                }),
                clients.length === 0 ? ClientService.getClients() : Promise.resolve(null),
            ])
            setInvoices(data)
            if (clientsData) setClients(clientsData)
        } catch (error) {
            console.error("Error loading invoices", error)
            toast.error(dict.invoices.error_load)
        } finally {
            setLoading(false)
        }
    }, [clients.length, dict.invoices.error_load, isAdmin, selectedClientId, selectedStatus, user, userLoading])

    useEffect(() => {
        if (userLoading || !user || !isAdmin) return
        startTransition(() => {
            void loadInvoices()
        })
    }, [loadInvoices, user, userLoading, isAdmin])

    const getClientName = (clientId: number) => {
        const client = clients.find(c => c.id === clientId)
        return client ? client.name : `Client ID: ${clientId}`
    }

    const getStatusText = (status: Invoice["status"]) =>
        getInvoiceStatusText(status, dict.invoices)

    const jobsLoadedRef = useRef(false)

    const loadInvoiceableTasks = useCallback(async (options?: { silent?: boolean }) => {
        if (userLoading || !user || !isAdmin) return

        const showLoader = !options?.silent && !jobsLoadedRef.current

        try {
            if (showLoader) setLoadingJobs(true)

            const jobs = await InvoiceService.getCompletedJobs()
            const refreshedClients = await ClientService.getClients(true).catch(() => null)

            if (refreshedClients) {
                setClients((prev) => mergeClientsIfChanged(prev, refreshedClients))
            }

            setInvoiceableTasks((prev) =>
                mergeInvoiceableTasksIfChanged(prev, mapCompletedJobsToTasks(jobs))
            )
            jobsLoadedRef.current = true
        } catch (error) {
            console.error("Error loading completed jobs", error)
            toast.error("No se pudieron cargar los trabajos completados.")
        } finally {
            setLoadingJobs(false)
        }
    }, [isAdmin, user, userLoading])

    useEffect(() => {
        if (activeView !== "jobs" || userLoading || !user || !isAdmin) return
        startTransition(() => {
            void loadInvoiceableTasks()
        })
    }, [activeView, user, userLoading, isAdmin, loadInvoiceableTasks])

    const filteredInvoiceableTasks = filterInvoiceableTasks(invoiceableTasks, {
        partyFilter: jobPartyFilter,
        invoiceFilter: jobInvoiceFilter,
        search: jobSearch,
        dateFrom: jobDateFrom,
        dateTo: jobDateTo,
    })

    const collaboratorOptions = getCollaboratorOptions(invoiceableTasks)
    const selectedJobIdSet = new Set(selectedJobIds)
    const selectedJobs = invoiceableTasks.filter(task => selectedJobIdSet.has(task.id))
    const selectedJobsClientId = selectedJobs[0]?.clientId
    const visibleInvoices = filterVisibleInvoices(invoices, invoiceSearch, getClientName, dict.invoices)
    const invoiceStats = computeInvoiceStats(invoices)
    const statusCounts = computeStatusCounts(invoices)

    const resetCreateForm = () => {
        setCreateSheet((current) => ({
            ...current,
            open: false,
            clientId: undefined,
            taskIds: [],
            tasks: [],
        }))
    }

    const openCreateSheet = (payload?: {
        clientId?: string
        taskIds?: number[]
        tasks?: InvoiceableTask[]
    }) => {
        setCreateSheet((current) => ({
            open: true,
            clientId: payload?.clientId,
            taskIds: payload?.taskIds ?? [],
            tasks: payload?.tasks ?? [],
            dialogKey: current.dialogKey + 1,
        }))
    }

    const handleToggleJob = (task: InvoiceableTask) => {
        if (task.is_invoiced) return

        if (selectedJobs.length > 0 && selectedJobsClientId !== task.clientId) {
            setSelectedJobIds([task.id])
            toast.info("Selección cambiada al cliente de este trabajo.")
            return
        }

        setSelectedJobIds(prev =>
            prev.includes(task.id)
                ? prev.filter(id => id !== task.id)
                : [...prev, task.id]
        )
    }

    const handleJobFilterChange = <T,>(setter: (value: T) => void, value: T) => {
        setter(value)
        setSelectedJobIds([])
    }

    if (userLoading || (activeView === "invoices" && loading)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <span className="text-xs text-[var(--text-muted)]">{dict.dashboard.invoices_loading || "Cargando facturas..."}</span>
            </div>
        )
    }

    if (!user || !isAdmin) {
        return null
    }

    return (
        <div className="dashboard-page-content px-3 py-4 sm:px-5 lg:px-7">
            <div className="mx-auto max-w-[90rem] space-y-5">
                <InvoicesPageHeader
                    title={dict.invoices.list_title}
                    subtitle={dict.invoices?.list_subtitle || "Crea, gestiona y descarga borradores y facturas de tus trabajos."}
                    newInvoiceLabel={dict.invoices.new_invoice}
                    onCreateInvoice={() => openCreateSheet()}
                />

                {activeView === "invoices" && (
                    <InvoicesStatsCards
                        stats={invoiceStats}
                        statusCounts={statusCounts}
                        labels={dict.invoices}
                    />
                )}

                <InvoicesTabPanels
                    activeView={activeView}
                    onActiveViewChange={setActiveView}
                    tabLabels={dict.invoices}
                    filtersProps={{
                        search: invoiceSearch,
                        onSearchChange: setInvoiceSearch,
                        selectedClientId,
                        onClientChange: setSelectedClientId,
                        selectedStatus,
                        onStatusChange: setSelectedStatus,
                        onReset: () => {
                            setInvoiceSearch("")
                            setSelectedClientId("")
                            setSelectedStatus("")
                        },
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
                            if (selectedJobs.length === 0 || !selectedJobsClientId) return
                            openCreateSheet({
                                clientId: selectedJobsClientId.toString(),
                                taskIds: selectedJobIds,
                                tasks: selectedJobs,
                            })
                        },
                        labels: {
                            ...dict.invoices,
                            jobs_loading: dict.dashboard?.jobs_loading,
                            task_title: dict.tasks?.task_title,
                            location_label: dict.tasks?.dialog?.location_label,
                            col_date: dict.quotes?.col_date,
                            invoiced: dict.locations?.sheet?.invoiced,
                            status_pending: dict.clients?.details?.status_pending,
                        },
                    }}
                    listProps={{
                        invoices: visibleInvoices,
                        loading,
                        loadingLabel: dict.dashboard.invoices_loading || "Cargando facturas...",
                        emptyLabel: dict.invoices.empty,
                        getClientName,
                        getStatusText,
                        onOpenInvoice: setSelectedInvoiceId,
                        labels: dict.invoices,
                    }}
                />

                <InvoiceCreateSheet
                    key={createSheet.dialogKey}
                    open={createSheet.open}
                    onOpenChange={(open) => {
                        if (!open) {
                            resetCreateForm()
                            return
                        }
                        setCreateSheet((current) => ({ ...current, open: true }))
                    }}
                    onInvoiceCreated={() => {
                        loadInvoices()
                        loadInvoiceableTasks({ silent: true })
                        setSelectedJobIds([])
                    }}
                    initialClientId={createSheet.clientId}
                    initialTaskIds={createSheet.taskIds}
                    initialTasks={createSheet.tasks}
                />

                <Dialog open={selectedInvoiceId !== null} onOpenChange={(open) => {
                    if (!open) {
                        setSelectedInvoiceId(null)
                        void loadInvoices()
                    }
                }}>
                    <DialogContent className="flex h-[min(94vh,calc(100%-1rem))] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl lg:max-w-7xl">
                        <DialogTitle className="sr-only">Detalle de factura</DialogTitle>
                        {selectedInvoiceId !== null && (
                            <InvoiceDetailView
                                invoiceId={selectedInvoiceId}
                                embedded
                                onChanged={() => void loadInvoices()}
                            />
                        )}
                    </DialogContent>
                </Dialog>

            </div>
        </div>
    )
}
