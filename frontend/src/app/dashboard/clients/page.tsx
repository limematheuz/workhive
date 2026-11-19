"use client";

import { Suspense, useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Loader2, ShieldAlert } from "lucide-react";

import { ClientDetailDialog } from "@/components/clients/ClientDetailDialog";
import { ClientAccountAssignmentDialog } from "@/components/clients/ClientAccountAssignmentDialog";
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
import { Button } from "@/components/ui/button";
import { FinanceLoadError } from "@/components/finance/FinanceLoadError";
import { useWorkspaceNavigation } from "@/components/dashboard/WorkspaceNavigationProvider";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { canViewFinance } from "@/domain/access/roles";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeEvents";
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
import { ClientAccountAssignmentService } from "@/services/client-account-assignment.service";
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
    locationsAvailable: boolean;
    tasksAvailable: boolean;
    invoices: Invoice[] | undefined;
    portfolioClientIds: number[];
    portfolioView: "all" | "mine";
    filters: ClientWorkspaceFilter;
    loading: boolean;
    loadError: boolean;
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
    assigningAccountClient: Client | null;
    accountAssignmentDialogOpen: boolean;
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
    locationsAvailable: false,
    tasksAvailable: false,
    invoices: undefined,
    portfolioClientIds: [],
    portfolioView: "all",
    filters: EMPTY_FILTERS,
    loading: true,
    loadError: false,
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
    assigningAccountClient: null,
    accountAssignmentDialogOpen: false,
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
    return <Suspense fallback={<p role="status" className="p-6 text-sm text-muted-foreground">Cargando clientes…</p>}><ClientsPageContent /></Suspense>;
}

function ClientsPageContent() {
    const { dict } = useDictionary();
    const { user, loading: userLoading } = useUser();
    const params = useSearchParams();
    const router = useRouter();
    const requestedClientId = Number(params.get("clientId"));
    const { canAccessPath, loading: accessLoading } = useWorkspaceNavigation();
    const canReadLocations = canAccessPath("/dashboard/locations");
    const canReadTasks = canReadLocations && canAccessPath("/dashboard/tasks");
    const [pageState, dispatch] = useReducer(clientsPageReducer, CLIENTS_PAGE_INITIAL_STATE);
    const {
        clients,
        locations,
        tasks,
        invoices,
        portfolioClientIds,
        portfolioView,
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
        assigningAccountClient,
        accountAssignmentDialogOpen,
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
    const openedRequest = useRef("");
    useEffect(() => {
        if (!Number.isSafeInteger(requestedClientId) || requestedClientId <= 0) { openedRequest.current = ""; return; }
        if (!canReadClients || loading) return;
        const key = `${user?.id}:${user?.company_id}:${requestedClientId}`;
        if (openedRequest.current === key) return;
        let active = true;
        const open = async () => {
            try {
                const client = clients.find((item) => item.id === requestedClientId) ?? await ClientService.getClient(requestedClientId);
                if (!active) return;
                openedRequest.current = key;
                if (!clients.some((item) => item.id === client.id)) setPageState("clients", [...clients, client]);
                setPageState("detailsClient", client);
                setPageState("detailsDialogOpen", true);
            } catch {
                if (active) { openedRequest.current = key; toast.error("El cliente solicitado no está disponible con tus permisos actuales."); }
            }
        };
        const timer = window.setTimeout(() => void open(), 0);
        return () => { active = false; window.clearTimeout(timer); };
    }, [canReadClients, clients, loading, requestedClientId, setPageState, user?.company_id, user?.id]);

    const loadClients = useCallback(async () => {
        if (userLoading || accessLoading || !user) return;
        const isInitialLoad = !hasLoadedRef.current;
        if (isInitialLoad) setPageState("loading", true);
        setPageState("loadError", false);

        try {
            const clientAccess = await ClientService.getAccess();
            setPageState("access", clientAccess);
            if (!clientAccess.can_read_clients) {
                setPageState("clients", []);
                setPageState("locations", []);
                setPageState("tasks", []);
                setPageState("invoices", undefined);
                setPageState("portfolioClientIds", []);
                return;
            }
            const [clientData, portfolioData, locationData, taskData, invoiceData] = await Promise.all([
                ClientService.getAllClients(null),
                ClientAccountAssignmentService.getMyPortfolio().catch(() => []),
                canReadLocations ? LocationService.getAllLocations().catch(() => undefined) : Promise.resolve(undefined),
                canReadTasks ? TaskService.getAllTaskItems().catch(() => undefined) : Promise.resolve(undefined),
                canViewClientFinancials
                    ? InvoiceService.getAllInvoices().catch(() => undefined)
                    : Promise.resolve(undefined),
            ]);
            setPageState("clients", clientData);
            setPageState("portfolioClientIds", portfolioData.map((item) => item.client.id));
            setPageState("locations", locationData ?? []);
            setPageState("tasks", taskData ?? []);
            setPageState("locationsAvailable", locationData !== undefined);
            setPageState("tasksAvailable", taskData !== undefined && locationData !== undefined);
            setPageState("invoices", invoiceData);
        } catch {
            setPageState("loadError", true);
            if (isInitialLoad) toast.error(dict.clients.workspace.load_error);
        } finally {
            setPageState("accessResolved", true);
            hasLoadedRef.current = true;
            setPageState("loading", false);
        }
    }, [canViewClientFinancials, dict.clients.workspace.load_error, setPageState, user, userLoading, accessLoading, canReadLocations, canReadTasks]);

    useEffect(() => {
        if (userLoading || !user) return;
        const timeoutId = window.setTimeout(() => void loadClients(), 0);
        return () => window.clearTimeout(timeoutId);
    }, [loadClients, user, userLoading]);

    useBackgroundPolling(
        loadClients,
        POLL_INTERVALS.clients,
        POLL_INTERVALS.realtimeSafety,
    );
    useRealtimeInvalidation(["clients", "locations", "tasks"], () => {
        void loadClients();
    });

    const workspace = useMemo(
        () => buildClientWorkspace({ clients, locations: pageState.locationsAvailable ? locations : undefined, tasks: pageState.tasksAvailable ? tasks : undefined, invoices, referenceDate: workspaceReferenceDate }),
        [clients, invoices, locations, tasks, workspaceReferenceDate, pageState.locationsAvailable, pageState.tasksAvailable],
    );
    const filteredRows = useMemo(() => filterClientWorkspaceRows(workspace.rows, filters), [filters, workspace.rows]);
    const portfolioClientIdSet = useMemo(() => new Set(portfolioClientIds), [portfolioClientIds]);
    const visibleRows = useMemo(
        () => portfolioView === "mine"
            ? filteredRows.filter((row) => portfolioClientIdSet.has(row.client.id))
            : filteredRows,
        [filteredRows, portfolioClientIdSet, portfolioView],
    );
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
                ) : pageState.loadError ? <FinanceLoadError message="No se ha podido consultar la lista completa de clientes. Vuelve a intentarlo para ver sus datos." onRetry={() => void loadClients()} /> : !canReadClients ? (
                    <Card className="mx-auto max-w-xl">
                        <CardContent className="py-14 text-center">
                            <ShieldAlert className="mx-auto size-7 text-accent" aria-hidden="true" />
                            <h2 className="mt-4 text-base font-semibold text-[var(--text-main)]">{dict.clients.workspace.access_denied_title}</h2>
                            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--text-muted)]">{dict.clients.workspace.access_denied_description}</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <ClientWorkspaceStats summary={visibleSummary} monthlyRevenue={monthlyRevenue} onFilter={(kind) => setPageState("filters", kind === "all" ? filters : { ...filters, ...(kind === "active" ? { status: "active" as const } : kind === "missing" ? { contact: "missing" as const } : { withBalance: true }) })} />
                        {(!pageState.locationsAvailable || !pageState.tasksAvailable) && <p role="status" className="rounded-xl border border-orange-400/30 bg-orange-400/5 p-3 text-xs">La actividad de {(!pageState.locationsAvailable ? "ubicaciones y trabajos" : "trabajos")} no está disponible para esta consulta. Un guion indica información no consultada.</p>}
                        {filters.withBalance && <div className="flex items-center justify-between rounded-xl border border-accent/20 p-3 text-xs">Clientes con saldo pendiente · {visibleRows.length}<Button variant="ghost" size="sm" onClick={() => setPageState("filters", { ...filters, withBalance: false })}>Quitar filtro</Button></div>}
                        {!workspace.summary.hasFinancialData && (
                            <p className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3 py-2 text-xs text-[var(--text-muted)]">
                                {dict.clients.workspace.financial_access_hint}
                            </p>
                        )}
                        <PremiumTabs
                            tabs={[
                                { id: "all", label: dict.clients.account_assignment.portfolio_all },
                                { id: "mine", label: dict.clients.account_assignment.portfolio_mine },
                            ]}
                            activeTab={portfolioView}
                            onChange={(nextView) => setPageState("portfolioView", nextView)}
                            className="max-w-md"
                            mobileLabel={dict.clients.account_assignment.portfolio_mine}
                        />
                        <ClientWorkspaceFilters filters={filters} cities={cities} onChange={(nextFilters) => setPageState("filters", nextFilters)} />
                        <ClientsTable
                            rows={visibleRows}
                            onEdit={handleEdit}
                            onDelete={handleDeleteClick}
                            onToggleActive={handleToggleActive}
                            onAssignAccount={(client) => {
                                setPageState("assigningAccountClient", client);
                                setPageState("accountAssignmentDialogOpen", true);
                            }}
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
            <ClientAccountAssignmentDialog
                client={assigningAccountClient}
                open={accountAssignmentDialogOpen}
                onOpenChange={(open) => {
                    setPageState("accountAssignmentDialogOpen", open);
                    if (!open) setPageState("assigningAccountClient", null);
                }}
                onSaved={loadClients}
            />
            <ClientDetailDialog
                client={detailsClient}
                workspaceRow={detailsRow}
                locations={locations}
                tasks={tasks}
                invoices={invoices ?? []}
                financialDataAvailable={workspace.summary.hasFinancialData}
                open={detailsDialogOpen}
                onOpenChange={(open) => {
                    setPageState("detailsDialogOpen", open);
                    if (!open && params.has("clientId")) { const query = new URLSearchParams(params.toString()); query.delete("clientId"); router.replace(`/dashboard/clients${query.size ? `?${query}` : ""}`, { scroll: false }); }
                }}
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
                permissions={{
                    canManage: canManageClients,
                    canReadCommercialFollowUps: access?.can_read_commercial_follow_ups === true,
                    canManageCommercialFollowUps: access?.can_manage_commercial_follow_ups === true,
                    canManageClientPortal: user?.role?.name === "admin",
                }}
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
