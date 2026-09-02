"use client";

import { BriefcaseBusiness, FileText, ListChecks, MapPin, PanelTop } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDictionary } from "@/lib/dictionary-context";
import type { ClientWorkspaceRow } from "@/lib/client-workspace";
import type { Client } from "@/services/client.service";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";
import type { Invoice } from "@/types/invoice";

import { ClientDetailBillingTab } from "./ClientDetailBillingTab";
import { ClientDetailLocationsTab } from "./ClientDetailLocationsTab";
import { ClientDetailOverview } from "./ClientDetailOverview";
import { ClientDetailTasksTab } from "./ClientDetailTasksTab";
import { ClientOpportunitiesTab } from "./ClientOpportunitiesTab";

export type ClientDetailTab = "overview" | "commercial" | "locations" | "tasks" | "billing";

type ClientDetailDialogTabsSectionProps = {
    activeTab: ClientDetailTab;
    onActiveTabChange: (tab: ClientDetailTab) => void;
    client: Client;
    row: ClientWorkspaceRow;
    locations: Location[];
    tasks: TaskItem[];
    filteredTasks: TaskItem[];
    invoices: Invoice[];
    financialDataAvailable: boolean;
    canManage: boolean;
    taskSearch: string;
    onTaskSearchChange: (value: string) => void;
    taskStatusFilter: string;
    onTaskStatusFilterChange: (value: string) => void;
    onViewLocationTasks: (location: Location) => void;
    onViewTaskDetails: (task: TaskItem) => void;
    onClose: () => void;
};

export function ClientDetailDialogTabsSection({
    activeTab,
    onActiveTabChange,
    client,
    row,
    locations,
    tasks,
    filteredTasks,
    invoices,
    financialDataAvailable,
    canManage,
    taskSearch,
    onTaskSearchChange,
    taskStatusFilter,
    onTaskStatusFilterChange,
    onViewLocationTasks,
    onViewTaskDetails,
    onClose,
}: ClientDetailDialogTabsSectionProps) {
    const { dict } = useDictionary();
    const workspace = dict.clients.workspace;
    const tabs = [
        { id: "overview" as const, label: workspace.overview, icon: PanelTop },
        { id: "commercial" as const, label: dict.clients.opportunities.tab, icon: BriefcaseBusiness },
        { id: "locations" as const, label: `${workspace.locations} (${locations.length})`, icon: MapPin },
        { id: "tasks" as const, label: `${workspace.jobs} (${tasks.length})`, icon: ListChecks },
        ...(financialDataAvailable ? [{ id: "billing" as const, label: `${dict.invoices.title} (${invoices.length})`, icon: FileText }] : []),
    ];

    return (
        <>
            <Tabs value={activeTab} onValueChange={(value) => onActiveTabChange(value as ClientDetailTab)}>
                <TabsList className={`grid h-auto w-full gap-1 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)]/40 p-1 ${tabs.length === 5 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"}`}>
                    {tabs.map(({ id, label, icon: Icon }) => <TabsTrigger key={id} value={id} className="min-w-0 gap-1.5 rounded-xl px-2 py-2.5 text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-main)] data-[state=active]:bg-accent data-[state=active]:text-white sm:text-xs"><Icon className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{label}</span></TabsTrigger>)}
                </TabsList>
            </Tabs>
            {activeTab === "overview" && <ClientDetailOverview client={client} row={row} locations={locations} tasks={tasks} financialDataAvailable={financialDataAvailable} canManage={canManage} onViewLocationTasks={onViewLocationTasks} onOpenLocations={() => onActiveTabChange("locations")} />}
            {activeTab === "commercial" && <ClientOpportunitiesTab client={client} canManage={canManage} />}
            {activeTab === "locations" && <ClientDetailLocationsTab locations={locations} onViewLocationTasks={onViewLocationTasks} onClose={onClose} />}
            {activeTab === "tasks" && <ClientDetailTasksTab filteredTasks={filteredTasks} locations={locations} taskSearch={taskSearch} onTaskSearchChange={onTaskSearchChange} taskStatusFilter={taskStatusFilter} onTaskStatusFilterChange={onTaskStatusFilterChange} getAssigneeName={(userId) => userId == null ? workspace.unassigned : workspace.assigned} onViewTaskDetails={onViewTaskDetails} onClose={onClose} labels={{ search_task: dict.clients.details.search_task, all_statuses: dict.clients.details.all_statuses, status_pending: dict.clients.details.status_pending, status_in_progress: dict.clients.details.status_in_progress, status_completed: dict.clients.details.status_completed, no_tasks: dict.clients.details.no_tasks, task: workspace.task, assignment: workspace.assignment, open_task: workspace.open_task }} />}
            {activeTab === "billing" && financialDataAvailable && <ClientDetailBillingTab invoices={invoices} />}
        </>
    );
}
