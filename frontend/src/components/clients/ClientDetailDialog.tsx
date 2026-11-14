"use client";

import { useMemo, useState } from "react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { ClientWorkspaceRow } from "@/lib/client-workspace";
import type { Client } from "@/services/client.service";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";
import type { Invoice } from "@/types/invoice";

import { ClientDetailDialogHeader } from "./ClientDetailDialogHeader";
import { ClientDetailDialogTabsSection, type ClientDetailPermissions, type ClientDetailTab } from "./ClientDetailDialogTabsSection";

type ClientDetailDialogProps = {
    client: Client | null;
    workspaceRow: ClientWorkspaceRow | null;
    locations: Location[];
    tasks: TaskItem[];
    invoices: Invoice[];
    financialDataAvailable: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onViewLocationTasks: (location: Location) => void;
    onViewTaskDetails: (task: TaskItem) => void;
    onEditClient?: (client: Client) => void;
    onToggleActiveClient?: (client: Client) => void;
    onDeleteClient?: (client: Client) => void;
    permissions?: Partial<ClientDetailPermissions>;
};

type ResolvedClientDetailProps = Omit<ClientDetailDialogProps, "client" | "workspaceRow"> & { client: Client; workspaceRow: ClientWorkspaceRow };
type ClientDetailNavigation = { activeTab: ClientDetailTab; taskSearch: string; taskStatusFilter: string };
const INITIAL_NAVIGATION: ClientDetailNavigation = { activeTab: "overview", taskSearch: "", taskStatusFilter: "ALL" };

export function ClientDetailDialog(props: ClientDetailDialogProps) {
    const { client, workspaceRow } = props;
    if (!client || !workspaceRow) return null;
    return <ClientDetailDialogSession key={client.id} {...props} client={client} workspaceRow={workspaceRow} />;
}

function ClientDetailDialogSession({ client, workspaceRow, open, onOpenChange, ...bodyProps }: ResolvedClientDetailProps) {
    const [navigation, setNavigation] = useState(INITIAL_NAVIGATION);
    const changeOpen = (nextOpen: boolean) => {
        if (!nextOpen) setNavigation(INITIAL_NAVIGATION);
        onOpenChange(nextOpen);
    };

    return (
        <Dialog open={open} onOpenChange={changeOpen}>
            <DialogContent className="flex max-h-[92vh] w-full max-w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[86rem]">
                {open && <ClientDetailDialogBody {...bodyProps} client={client} workspaceRow={workspaceRow} onOpenChange={changeOpen} navigation={navigation} onNavigationChange={(patch) => setNavigation(current => ({ ...current, ...patch }))} onNavigateAway={() => onOpenChange(false)} />}
            </DialogContent>
        </Dialog>
    );
}

function ClientDetailDialogBody({
    client,
    workspaceRow,
    locations,
    tasks,
    invoices,
    financialDataAvailable,
    onOpenChange,
    onViewLocationTasks,
    onViewTaskDetails,
    onEditClient,
    onToggleActiveClient,
    onDeleteClient,
    navigation,
    onNavigationChange,
    onNavigateAway,
    permissions: providedPermissions = {},
}: Omit<ResolvedClientDetailProps, "open"> & {
    navigation: ClientDetailNavigation;
    onNavigationChange: (patch: Partial<ClientDetailNavigation>) => void;
    onNavigateAway: () => void;
}) {
    const permissions: ClientDetailPermissions = {
        canManage: false,
        canReadCommercialFollowUps: false,
        canManageCommercialFollowUps: false,
        canManageClientPortal: false,
        ...providedPermissions,
    };
    const { activeTab, taskSearch, taskStatusFilter } = navigation;
    const clientLocations = useMemo(() => locations.filter((location) => location.client_id === client.id), [client.id, locations]);
    const clientLocationIds = useMemo(() => new Set(clientLocations.map((location) => location.id)), [clientLocations]);
    const clientTasks = useMemo(() => tasks.filter((task) => clientLocationIds.has(task.location_id)), [clientLocationIds, tasks]);
    const clientInvoices = useMemo(() => invoices.filter((invoice) => invoice.client_id === client.id), [client.id, invoices]);
    const filteredTasks = useMemo(() => clientTasks.filter((task) => {
        const search = taskSearch.trim().toLocaleLowerCase();
        const matchesSearch = !search || task.title.toLocaleLowerCase().includes(search) || Boolean(task.description?.toLocaleLowerCase().includes(search));
        const normalizedStatus = task.status.toLocaleLowerCase().replaceAll("-", "_");
        const statusGroup = normalizedStatus === "completed"
            ? "completed"
            : ["progress", "in_progress", "started"].includes(normalizedStatus)
                ? "progress"
                : ["pending", "accepted", "requested", "review"].includes(normalizedStatus)
                    ? "pending"
                    : normalizedStatus;
        return matchesSearch && (taskStatusFilter === "ALL" || taskStatusFilter === statusGroup);
    }), [clientTasks, taskSearch, taskStatusFilter]);

    const closeAndOpenLocationTasks = (location: Location) => {
        onNavigateAway();
        onViewLocationTasks(location);
    };
    const closeAndOpenTaskDetails = (task: TaskItem) => {
        onNavigateAway();
        onViewTaskDetails(task);
    };

    return (
        <>
            <ClientDetailDialogHeader
                client={client}
                canManage={permissions.canManage}
                onEditClient={onEditClient}
                onToggleActiveClient={onToggleActiveClient}
                onDeleteClient={onDeleteClient}
                onClose={() => onOpenChange(false)}
            />
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-7">
                <ClientDetailDialogTabsSection
                    activeTab={activeTab}
                    onActiveTabChange={(activeTab) => onNavigationChange({ activeTab })}
                    client={client}
                    row={workspaceRow}
                    locations={clientLocations}
                    tasks={clientTasks}
                    filteredTasks={filteredTasks}
                    invoices={clientInvoices}
                    financialDataAvailable={financialDataAvailable}
                    permissions={permissions}
                    taskSearch={taskSearch}
                    onTaskSearchChange={(taskSearch) => onNavigationChange({ taskSearch })}
                    taskStatusFilter={taskStatusFilter}
                    onTaskStatusFilterChange={(taskStatusFilter) => onNavigationChange({ taskStatusFilter })}
                    onViewLocationTasks={closeAndOpenLocationTasks}
                    onViewTaskDetails={closeAndOpenTaskDetails}
                    onClose={onNavigateAway}
                />
            </div>
        </>
    );
}
