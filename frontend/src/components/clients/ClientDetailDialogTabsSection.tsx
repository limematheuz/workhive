"use client";

import { BriefcaseBusiness, FileText, ListChecks, MapPin, PanelTop, UsersRound } from "lucide-react";

import { PremiumTabs } from "@/components/ui/premium-tabs";
import { useDictionary } from "@/lib/dictionary-context";
import type { ClientWorkspaceRow } from "@/lib/client-workspace";
import type { Client } from "@/services/client.service";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";
import type { Invoice } from "@/types/invoice";

import { ClientDetailBillingTab } from "./ClientDetailBillingTab";
import { ClientContactsTab } from "./ClientContactsTab";
import { ClientDetailLocationsTab } from "./ClientDetailLocationsTab";
import { ClientDetailOverview } from "./ClientDetailOverview";
import { ClientDetailTasksTab } from "./ClientDetailTasksTab";
import { ClientOpportunitiesTab } from "./ClientOpportunitiesTab";

export type ClientDetailTab = "overview" | "contacts" | "commercial" | "locations" | "tasks" | "billing";

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
        { id: "contacts" as const, label: dict.clients.contacts.tab, icon: UsersRound },
        { id: "commercial" as const, label: dict.clients.opportunities.tab, icon: BriefcaseBusiness },
        { id: "locations" as const, label: `${workspace.locations} (${locations.length})`, icon: MapPin },
        { id: "tasks" as const, label: `${workspace.jobs} (${tasks.length})`, icon: ListChecks },
        ...(financialDataAvailable ? [{ id: "billing" as const, label: `${dict.invoices.title} (${invoices.length})`, icon: FileText }] : []),
    ];

    return (
        <>
            <PremiumTabs tabs={tabs} activeTab={activeTab} onChange={onActiveTabChange} className="mb-5" layout="scroll" />
            {activeTab === "overview" && <ClientDetailOverview client={client} row={row} locations={locations} tasks={tasks} financialDataAvailable={financialDataAvailable} onViewLocationTasks={onViewLocationTasks} onOpenLocations={() => onActiveTabChange("locations")} />}
            {activeTab === "contacts" && <ClientContactsTab client={client} canManage={canManage} />}
            {activeTab === "commercial" && <ClientOpportunitiesTab client={client} canManage={canManage} />}
            {activeTab === "locations" && <ClientDetailLocationsTab locations={locations} onViewLocationTasks={onViewLocationTasks} onClose={onClose} />}
            {activeTab === "tasks" && <ClientDetailTasksTab filteredTasks={filteredTasks} locations={locations} taskSearch={taskSearch} onTaskSearchChange={onTaskSearchChange} taskStatusFilter={taskStatusFilter} onTaskStatusFilterChange={onTaskStatusFilterChange} getAssigneeName={(userId) => userId == null ? workspace.unassigned : workspace.assigned} onViewTaskDetails={onViewTaskDetails} onClose={onClose} labels={{ search_task: dict.clients.details.search_task, all_statuses: dict.clients.details.all_statuses, status_pending: dict.clients.details.status_pending, status_in_progress: dict.clients.details.status_in_progress, status_completed: dict.clients.details.status_completed, no_tasks: dict.clients.details.no_tasks, task: workspace.task, assignment: workspace.assignment, open_task: workspace.open_task }} />}
            {activeTab === "billing" && financialDataAvailable && <ClientDetailBillingTab invoices={invoices} />}
        </>
    );
}
