"use client";

import { FileText, ListChecks, MapPin, PanelTop } from "lucide-react";

import { PremiumTabs } from "@/components/ui/premium-tabs";
import type { ClientWorkspaceRow } from "@/lib/client-workspace";
import type { Client } from "@/services/client.service";
import type { Location } from "@/services/location.service";
import type { TaskItem } from "@/services/task.service";
import type { Invoice } from "@/types/invoice";

import { ClientDetailBillingTab } from "./ClientDetailBillingTab";
import { ClientDetailLocationsTab } from "./ClientDetailLocationsTab";
import { ClientDetailOverview } from "./ClientDetailOverview";
import { ClientDetailTasksTab } from "./ClientDetailTasksTab";

export type ClientDetailTab = "overview" | "locations" | "tasks" | "billing";

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
    taskSearch,
    onTaskSearchChange,
    taskStatusFilter,
    onTaskStatusFilterChange,
    onViewLocationTasks,
    onViewTaskDetails,
    onClose,
}: ClientDetailDialogTabsSectionProps) {
    const tabs = [
        { id: "overview" as const, label: "Resumen", icon: PanelTop },
        { id: "locations" as const, label: `Ubicaciones (${locations.length})`, icon: MapPin },
        { id: "tasks" as const, label: `Trabajos (${tasks.length})`, icon: ListChecks },
        ...(financialDataAvailable ? [{ id: "billing" as const, label: `Facturación (${invoices.length})`, icon: FileText }] : []),
    ];

    return (
        <>
            <PremiumTabs tabs={tabs} activeTab={activeTab} onChange={onActiveTabChange} className="mb-5" layout="scroll" />
            {activeTab === "overview" && <ClientDetailOverview client={client} row={row} locations={locations} tasks={tasks} financialDataAvailable={financialDataAvailable} onViewLocationTasks={onViewLocationTasks} onOpenLocations={() => onActiveTabChange("locations")} />}
            {activeTab === "locations" && <ClientDetailLocationsTab locations={locations} onViewLocationTasks={onViewLocationTasks} onClose={onClose} />}
            {activeTab === "tasks" && <ClientDetailTasksTab filteredTasks={filteredTasks} locations={locations} taskSearch={taskSearch} onTaskSearchChange={onTaskSearchChange} taskStatusFilter={taskStatusFilter} onTaskStatusFilterChange={onTaskStatusFilterChange} getAssigneeName={(userId) => userId == null ? "Sin asignar" : "Asignado"} onViewTaskDetails={onViewTaskDetails} onClose={onClose} labels={{ search_task: "Buscar trabajo…", all_statuses: "Todos los estados", status_pending: "Pendientes", status_in_progress: "En curso", status_completed: "Completadas", no_tasks: "No hay trabajos con estos filtros." }} />}
            {activeTab === "billing" && financialDataAvailable && <ClientDetailBillingTab invoices={invoices} />}
        </>
    );
}
