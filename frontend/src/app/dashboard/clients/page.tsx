"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { Building2, Loader2, ShieldAlert } from "lucide-react";

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
import { Card, CardContent } from "@/components/ui/card";
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
import { ClientService, type Client, type ClientAccess } from "@/services/client.service";
import { InvoiceService } from "@/services/invoice.service";
import { LocationService, type Location } from "@/services/location.service";
import { TaskService, type TaskItem } from "@/services/task.service";
import type { Invoice } from "@/types/invoice";

const EMPTY_FILTERS: ClientWorkspaceFilter = {
    search: "",
    status: "all",
    clientType: "all",
    relationship: "all",
    city: "",
    contact: "all",
};

type ClientsPageState = {
    clients: Client[];
    locations: Location[];
    tasks: TaskItem[];
    invoices: Invoice[] | undefined;
    filters: ClientWorkspaceFilter;
    loading: boolean;
    access: ClientAccess | null;
    accessResolved: boolean;
    editingClient: Client | null;
    editSheetOpen: boolean;
    deleteDialogOpen: boolean;
    isDeleting: boolean;
    detailsClient: Client | null;
    detailsDialogOpen: boolean;
    tasksLocation: Location | null;
    tasksSheetOpen: boolean;
    viewingTask: TaskItem | null;
    backToClient: boolean;
};

type ClientsPageSetAction = {
    [Key in keyof ClientsPageState]: {
        type: "set";
        key: Key;
        value: ClientsPageState[Key];
    };
}[keyof ClientsPageState];

type ClientsPageAction = ClientsPageSetAction | {
    type: "toggle-client-active";
    clientId: number;
    isActive: boolean;
};

const CLIENTS_PAGE_INITIAL_STATE: ClientsPageState = {
    clients: [],
    locations: [],
    tasks: [],
    invoices: undefined,
    filters: EMPTY_FILTERS,
    loading: true,
    access: null,
    accessResolved: false,
    editingClient: null,
    editSheetOpen: false,
    deleteDialogOpen: false,
    isDeleting: false,
    detailsClient: null,
    detailsDialogOpen: false,
    tasksLocation: null,
    tasksSheetOpen: false,
    viewingTask: null,
    backToClient: false,
};

function clientsPageReducer(
    state: ClientsPageState,
    action: ClientsPageAction,
): ClientsPageState {
    if (action.type === "set") {
        return { ...state, [action.key]: action.value };
    }

    return {
        ...state,
        clients: state.clients.map((client) => (
            client.id === action.clientId ? { ...client, is_active: action.isActive } : client
        )),
        detailsClient: state.detailsClient?.id === action.clientId
            ? { ...state.detailsClient, is_active: action.isActive }
            : state.detailsClient,
    };
}

export default function ClientsPage() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const [pageState, dispatch] = useReducer(clientsPageReducer, CLIENTS_PAGE_INITIAL_STATE);
    const {
        clients,
        locations,
        tasks,
        invoices,
        filters,
        loading,
        access,
        accessResolved,
        editingClient,
        editSheetOpen,
        deleteDialogOpen,
        isDeleting,
        detailsClient,
        detailsDialogOpen,
        tasksLocation,
        tasksSheetOpen,
        viewingTask,
        backToClient,
    } = pageState;
    const workspaceReferenceDate = useMemo(() => new Date(), []);
    const hasLoadedRef = useRef(false);
    const setPageState = useCallback(<Key extends keyof ClientsPageState>(
        key: Key,
        value: ClientsPageState[Key],
    ) => {
        dispatch({ type: "set", key, value } as ClientsPageSetAction);
    }, []);

    const canReadClients = access?.can_read_clients === true;
    const canManageClients = access?.can_manage_clients === true;
    const canViewClientFinancials = canViewFinance(user) && Boolean(user?.company_id);
    const deletingClientRef = useRef<Client | null>(null);

    const loadClients = useCallback(async () => {
        if (userLoading || !user) return;
        const isInitialLoad = !hasLoadedRef.current;
        if (isInitialLoad) setPageState("loading", true);

        try {
            const clientAccess = await ClientService.getAccess();
            setPageState("access", clientAccess);
            if (!clientAccess.can_read_clients) {
                setPageState("clients", []);
                setPageState("locations", []);
                setPageState("tasks", []);
                setPageState("invoices", undefined);
                return;
            }
            const [clientData, locationData, taskData, invoiceData] = await Promise.all([
                ClientService.getClients(null),
                LocationService.getLocations().catch(() => [] as Location[]),
                TaskService.getAllTaskItems().catch(() => [] as TaskItem[]),
                canViewClientFinancials
                    ? InvoiceService.getAllInvoices().catch(() => undefined)
                    : Promise.resolve(undefined),
            ]);
            setPageState("clients", clientData);
            setPageState("locations", locationData);
            setPageState("tasks", taskData);
            setPageState("invoices", invoiceData);
        } catch {
            if (isInitialLoad) toast.error(dict.clients.workspace.load_error);
        } finally {
            setPageState("accessResolved", true);
            hasLoadedRef.current = true;
            setPageState("loading", false);
        }
    }, [canViewClientFinancials, dict.clients.workspace.load_error, setPageState, user, userLoading]);

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
        setPageState("editingClient", client);
        setPageState("editSheetOpen", true);
    };

    const handleDeleteClick = (client: Client) => {
        deletingClientRef.current = client;
        setPageState("deleteDialogOpen", true);
    };

    const handleToggleActive = async (client: Client) => {
        try {
            await ClientService.updateClient(client.id, { is_active: !client.is_active });
            dispatch({ type: "toggle-client-active", clientId: client.id, isActive: !client.is_active });
            toast.success(client.is_active ? dict.clients.workspace.deactivated : dict.clients.workspace.activated);
            void loadClients();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : dict.clients.form.update_error_toast);
        }
    };

    const handleDeleteConfirm = async () => {
        const deletingClient = deletingClientRef.current;
        if (!deletingClient) return;
        setPageState("isDeleting", true);
        try {
            await ClientService.deleteClient(deletingClient.id);
            toast.success(dict.clients.form.delete_success_toast);
            setPageState("deleteDialogOpen", false);
            deletingClientRef.current = null;
            void loadClients();
        } catch {
            toast.error(dict.clients.form.delete_error_toast);
        } finally {
            setPageState("isDeleting", false);
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
                            {canReadClients && <ClientWorkspaceExportButton
                                rows={visibleRows}
                                includeFinancialData={workspace.summary.hasFinancialData}
                                year={workspaceReferenceDate.getFullYear()}
                            />}
                            {canManageClients && <CreateClientSheet onClientCreated={loadClients} />}
                        </>
                    )}
                />

                {loading || !accessResolved ? (
                    <section className="billing-surface flex min-h-80 flex-col items-center justify-center gap-3 rounded-[26px]">
                        <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden="true" />
                        <p className="text-sm text-[var(--text-muted)]">{dict.clients.workspace.loading}</p>
                    </section>
                ) : !canReadClients ? (
                    <Card className="mx-auto max-w-xl">
                        <CardContent className="py-14 text-center">
                            <ShieldAlert className="mx-auto size-7 text-accent" aria-hidden="true" />
                            <h2 className="mt-4 text-base font-semibold text-[var(--text-main)]">{dict.clients.workspace.access_denied_title}</h2>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">{dict.clients.workspace.access_denied_description}</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <ClientWorkspaceStats summary={visibleSummary} monthlyRevenue={monthlyRevenue} />
                        {!workspace.summary.hasFinancialData && (
                            <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs text-[var(--text-muted)]">
                                {dict.clients.workspace.financial_access_hint}
                            </p>
                        )}
                        <ClientWorkspaceFilters filters={filters} cities={cities} onChange={(nextFilters) => setPageState("filters", nextFilters)} />
                        <ClientsTable
                            rows={visibleRows}
                            onEdit={handleEdit}
                            onDelete={handleDeleteClick}
                            onToggleActive={handleToggleActive}
                            onDetails={(client) => {
                                setPageState("detailsClient", client);
                                setPageState("detailsDialogOpen", true);
                            }}
                            canManage={canManageClients}
                        />
                    </>
                )}
            </div>

            <EditClientSheet client={editingClient} open={editSheetOpen} onOpenChange={(open) => setPageState("editSheetOpen", open)} onClientUpdated={loadClients} />
            <ClientDetailDialog
                client={detailsClient}
                workspaceRow={detailsRow}
                locations={locations}
                tasks={tasks}
                invoices={invoices ?? []}
                financialDataAvailable={workspace.summary.hasFinancialData}
                open={detailsDialogOpen}
                onOpenChange={(open) => setPageState("detailsDialogOpen", open)}
                onViewLocationTasks={(location) => {
                    setPageState("tasksLocation", location);
                    setPageState("tasksSheetOpen", true);
                }}
                onViewTaskDetails={(task) => {
                    if (user) acknowledgeTaskOpened(user.id, task);
                    setPageState("backToClient", true);
                    setPageState("viewingTask", task);
                }}
                onEditClient={handleEdit}
                onToggleActiveClient={handleToggleActive}
                onDeleteClient={handleDeleteClick}
                canManage={canManageClients}
                canReadCommercialFollowUps={access?.can_read_commercial_follow_ups === true}
                canManageCommercialFollowUps={access?.can_manage_commercial_follow_ups === true}
            />
            <LocationTasksSheet location={tasksLocation} open={tasksSheetOpen} onOpenChange={(open) => setPageState("tasksSheetOpen", open)} initialCreateForm={false} readOnly />
            <ClientTaskDetailDialog
                task={viewingTask}
                showBackToClient={backToClient}
                onClose={() => setPageState("viewingTask", null)}
                onBackToClient={() => {
                    setPageState("viewingTask", null);
                    setPageState("detailsDialogOpen", true);
                    setPageState("backToClient", false);
                }}
            />
            <DeleteConfirmDialog
                open={deleteDialogOpen}
                onOpenChange={(open) => {
                    setPageState("deleteDialogOpen", open);
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
