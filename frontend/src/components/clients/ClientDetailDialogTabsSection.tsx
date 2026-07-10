"use client";

import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Location } from "@/services/location.service";
import { TaskItem } from "@/services/task.service";

import { ClientDetailLocationsTab } from "./ClientDetailLocationsTab";
import { ClientDetailTasksTab } from "./ClientDetailTasksTab";

type ClientDetailDialogTabsSectionProps = {
    activeTab: "locations" | "tasks";
    onActiveTabChange: (tab: "locations" | "tasks") => void;
    locations: Location[];
    tasks: TaskItem[];
    filteredTasks: TaskItem[];
    taskSearch: string;
    onTaskSearchChange: (value: string) => void;
    taskStatusFilter: string;
    onTaskStatusFilterChange: (value: string) => void;
    getAssigneeName: (userId: number | null) => string;
    onViewLocationTasks: (location: Location) => void;
    onViewTaskDetails: (task: TaskItem) => void;
    onClose: () => void;
    labels: {
        locationsTab: string;
        tasksTab: string;
        locations: {
            no_locations?: string;
            ver_tareas?: string;
            type_private?: string;
            type_real_estate?: string;
            type_business?: string;
            type_exterior?: string;
            type_other?: string;
        };
        tasks: {
            search_task?: string;
            all_statuses?: string;
            status_pending?: string;
            status_in_progress?: string;
            status_completed?: string;
            no_tasks?: string;
        };
    };
};

export function ClientDetailDialogTabsSection({
    activeTab,
    onActiveTabChange,
    locations,
    tasks,
    filteredTasks,
    taskSearch,
    onTaskSearchChange,
    taskStatusFilter,
    onTaskStatusFilterChange,
    getAssigneeName,
    onViewLocationTasks,
    onViewTaskDetails,
    onClose,
    labels,
}: ClientDetailDialogTabsSectionProps) {
    return (
        <>
            <PremiumTabs
                tabs={[
                    {
                        id: "locations",
                        label: labels.locationsTab.replace(
                            "{count}",
                            locations.length.toString()
                        ),
                    },
                    {
                        id: "tasks",
                        label: labels.tasksTab.replace(
                            "{count}",
                            tasks.length.toString()
                        ),
                    },
                ]}
                activeTab={activeTab}
                onChange={onActiveTabChange}
                className="mb-4"
            />

            <div className="space-y-4">
                {activeTab === "locations" && (
                    <ClientDetailLocationsTab
                        locations={locations}
                        labels={{
                            no_locations: labels.locations.no_locations,
                            ver_tareas: labels.locations.ver_tareas,
                            type_private: labels.locations.type_private,
                            type_real_estate: labels.locations.type_real_estate,
                            type_business: labels.locations.type_business,
                            type_exterior: labels.locations.type_exterior,
                            type_other: labels.locations.type_other,
                        }}
                        onViewLocationTasks={onViewLocationTasks}
                        onClose={onClose}
                    />
                )}

                {activeTab === "tasks" && (
                    <ClientDetailTasksTab
                        filteredTasks={filteredTasks}
                        locations={locations}
                        taskSearch={taskSearch}
                        onTaskSearchChange={onTaskSearchChange}
                        taskStatusFilter={taskStatusFilter}
                        onTaskStatusFilterChange={onTaskStatusFilterChange}
                        getAssigneeName={getAssigneeName}
                        labels={{
                            search_task: labels.tasks.search_task,
                            all_statuses: labels.tasks.all_statuses,
                            status_pending: labels.tasks.status_pending,
                            status_in_progress: labels.tasks.status_in_progress,
                            status_completed: labels.tasks.status_completed,
                            no_tasks: labels.tasks.no_tasks,
                        }}
                        onViewTaskDetails={onViewTaskDetails}
                        onClose={onClose}
                    />
                )}
            </div>
        </>
    );
}
