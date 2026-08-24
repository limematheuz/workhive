"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, Loader2 } from "lucide-react";

import { ClientDetailDialog } from "@/components/clients/ClientDetailDialog";
import { ClientTaskDetailDialog } from "@/components/clients/ClientTaskDetailDialog";
import { ClientsTable } from "@/components/clients/ClientsTable";
import { ClientWorkspaceExportButton } from "@/components/clients/ClientWorkspaceExportButton";
import { ClientWorkspaceFilters } from "@/components/clients/ClientWorkspaceFilters";
import { ClientWorkspaceStats } from "@/components/clients/ClientWorkspaceStats";
import { CreateClientSheet } from "@/components/clients/CreateClientSheet";
import { EditClientSheet } from "@/components/clients/EditClientSheet";
import { acknowledgeTaskOpened } from "@/components/dashboard/notifications/task-notification-acknowledgement";
import { LocationTasksSheet } from "@/components/locations/LocationTasksSheet";
import { DeleteConfirmDialog } from "@/components/ui/delete-confirm-dialog";
import { PageHeader } from "@/components/ui/page-header";
import { canViewFinance } from "@/domain/access/roles";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { useDictionary } from "@/lib/dictionary-context";
import {
    buildClientWorkspace,
    filterClientWorkspaceRows,
    getClientWorkspaceMonthlyRevenue,
    getClientWorkspaceCities,
    summarizeClientWorkspaceRows,
    type ClientWorkspaceFilter,
} from "@/lib/client-workspace";
import { POLL_INTERVALS } from "@/lib/polling";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import { ClientService, type Client } from "@/services/client.service";
import { InvoiceService } from "@/services/invoice.service";
import { LocationService, type Location } from "@/services/location.service";
import { TaskService, type TaskItem } from "@/services/task.service";
import type { Invoice } from "@/types/invoice";

const EMPTY_FILTERS: ClientWorkspaceFilter = {
    search: "",
    status: "all",
    clientType: "all",
    city: "",
    contact: "all",
};

export default function ClientsPage() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const [clients, setClients] = useState<Client[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [invoices, setInvoices] = useState<Invoice[] | undefined>(undefined);
    const [filters, setFilters] = useState<ClientWorkspaceFilter>(EMPTY_FILTERS);
    const [loading, setLoading] = useState(true);
    const [workspaceReferenceDate] = useState(() => new Date());
    const hasLoadedRef = useRef(false);

    const isReadOnly = user?.role?.name === "viewer" || user?.role?.name === "manager";
    const canViewClientFinancials = canViewFinance(user) && Boolean(user?.company_id);
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [editSheetOpen, setEditSheetOpen] = useState(false);
    const deletingClientRef = useRef<Client | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [detailsClient, setDetailsClient] = useState<Client | null>(null);
    const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
    const [tasksLocation, setTasksLocation] = useState<Location | null>(null);
    const [tasksSheetOpen, setTasksSheetOpen] = useState(false);
    const [viewingTask, setViewingTask] = useState<TaskItem | null>(null);
    const [backToClient, setBackToClient] = useState(false);

    const loadClients = useCallback(async () => {
        if (userLoading || !user) return;
        const isInitialLoad = !hasLoadedRef.current;
        if (isInitialLoad) setLoading(true);

        try {
            const [clientData, locationData, taskData, invoiceData] = await Promise.all([
                ClientService.getClients(null),
                LocationService.getLocations().catch(() => [] as Location[]),
                TaskService.getAllTaskItems().catch(() => [] as TaskItem[]),
                canViewClientFinancials
                    ? InvoiceService.getAllInvoices().catch(() => undefined)
                    : Promise.resolve(undefined),
            ]);
            setClients(clientData);
            setLocations(locationData);
            setTasks(taskData);
            setInvoices(invoiceData);
        } catch {
            if (isInitialLoad) toast.error(dict.clients.workspace.load_error);
        } finally {
            hasLoadedRef.current = true;
            setLoading(false);
        }
    }, [canViewClientFinancials, dict.clients.workspace.load_error, user, userLoading]);

    useEffect(() => {
        if (userLoading || !user) return;
        const timeoutId = window.setTimeout(() => void loadClients(), 0);
        return () => window.clearTimeout(timeoutId);
    }, [loadClients, user, userLoading]);

    useBackgroundPolling(loadClients, POLL_INTERVALS.clients);

    const workspace = useMemo(
        () => buildClientWorkspace({ clients, locations, tasks, invoices, referenceDate: workspaceReferenceDate }),
        [clients, invoices, locations, tasks, workspaceReferenceDate],
    );
    const visibleRows = useMemo(() => filterClientWorkspaceRows(workspace.rows, filters), [filters, workspace.rows]);
    const visibleSummary = useMemo(
        () => summarizeClientWorkspaceRows(visibleRows, workspace.summary.hasFinancialData),
        [visibleRows, workspace.summary.hasFinancialData],
    );
    const monthlyRevenue = useMemo(
        () => getClientWorkspaceMonthlyRevenue(invoices, visibleRows, workspaceReferenceDate),
        [invoices, visibleRows, workspaceReferenceDate],
    );
    const cities = useMemo(() => getClientWorkspaceCities(workspace.rows), [workspace.rows]);
    const detailsRow = workspace.rows.find((row) => row.client.id === detailsClient?.id) ?? null;

    const handleEdit = (client: Client) => {
        setEditingClient(client);
        setEditSheetOpen(true);
    };

    const handleDeleteClick = (client: Client) => {
        deletingClientRef.current = client;
        setDeleteDialogOpen(true);
    };

    const handleToggleActive = async (client: Client) => {
        try {
            await ClientService.updateClient(client.id, { is_active: !client.is_active });
            setClients((current) => current.map((item) => item.id === client.id ? { ...item, is_active: !client.is_active } : item));
            setDetailsClient((current) => current?.id === client.id ? { ...current, is_active: !client.is_active } : current);
            toast.success(client.is_active ? dict.clients.workspace.deactivated : dict.clients.workspace.activated);
            void loadClients();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : dict.clients.form.update_error_toast);
        }
    };

    const handleDeleteConfirm = async () => {
        const deletingClient = deletingClientRef.current;
        if (!deletingClient) return;
        setIsDeleting(true);
        try {
            await ClientService.deleteClient(deletingClient.id);
            toast.success(dict.clients.form.delete_success_toast);
            setDeleteDialogOpen(false);
            deletingClientRef.current = null;
            void loadClients();
        } catch {
            toast.error(dict.clients.form.delete_error_toast);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="dashboard-page-content px-3 py-4 sm:px-5 lg:px-7">
            <div className="mx-auto max-w-[112rem] space-y-5">
                <PageHeader
                    icon={Building2}
                    title={dict.clients.title}
                    subtitle={dict.clients.workspace.subtitle}
                    actions={(
                        <>
                            <ClientWorkspaceExportButton
                                rows={visibleRows}
                                includeFinancialData={workspace.summary.hasFinancialData}
                                year={workspaceReferenceDate.getFullYear()}
                            />
                            {!isReadOnly && <CreateClientSheet onClientCreated={loadClients} />}
                        </>
                    )}
                />

                {loading ? (
                    <section className="billing-surface flex min-h-80 flex-col items-center justify-center gap-3 rounded-[26px]">
                        <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
                        <p className="text-sm text-[var(--text-muted)]">{dict.clients.workspace.loading}</p>
                    </section>
                ) : (
                    <>
                        <ClientWorkspaceStats summary={visibleSummary} monthlyRevenue={monthlyRevenue} />
                        {!workspace.summary.hasFinancialData && (
                            <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs text-[var(--text-muted)]">
                                {dict.clients.workspace.financial_access_hint}
                            </p>
                        )}
                        <ClientWorkspaceFilters filters={filters} cities={cities} onChange={setFilters} />
                        <ClientsTable
                            rows={visibleRows}
                            onEdit={handleEdit}
                            onDelete={handleDeleteClick}
                            onToggleActive={handleToggleActive}
                            onDetails={(client) => {
                                setDetailsClient(client);
                                setDetailsDialogOpen(true);
                            }}
                        />
                    </>
                )}
            </div>

            <EditClientSheet client={editingClient} open={editSheetOpen} onOpenChange={setEditSheetOpen} onClientUpdated={loadClients} />
            <ClientDetailDialog
                client={detailsClient}
                workspaceRow={detailsRow}
                locations={locations}
                tasks={tasks}
                invoices={invoices ?? []}
                financialDataAvailable={workspace.summary.hasFinancialData}
                open={detailsDialogOpen}
                onOpenChange={setDetailsDialogOpen}
                onViewLocationTasks={(location) => {
                    setTasksLocation(location);
                    setTasksSheetOpen(true);
                }}
                onViewTaskDetails={(task) => {
                    if (user) acknowledgeTaskOpened(user.id, task);
                    setBackToClient(true);
                    setViewingTask(task);
                }}
                onEditClient={handleEdit}
                onToggleActiveClient={handleToggleActive}
                onDeleteClient={handleDeleteClick}
                canManage={!isReadOnly}
            />
            <LocationTasksSheet location={tasksLocation} open={tasksSheetOpen} onOpenChange={setTasksSheetOpen} initialCreateForm={false} readOnly />
            <ClientTaskDetailDialog
                task={viewingTask}
                showBackToClient={backToClient}
                onClose={() => setViewingTask(null)}
                onBackToClient={() => {
                    setViewingTask(null);
                    setDetailsDialogOpen(true);
                    setBackToClient(false);
                }}
            />
            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) deletingClientRef.current = null;
                }}
                title={dict.clients.delete_dialog.title}
                description={dict.clients.delete_dialog.description}
                onConfirm={handleDeleteConfirm}
                isDeleting={isDeleting}
                confirmText={dict.clients.delete_dialog.confirm}
                cancelText={dict.clients.delete_dialog.cancel}
            />
        </div>
    );
}
