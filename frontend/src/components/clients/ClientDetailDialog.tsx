"use client";

import React, { useState, useEffect, useEffectEvent } from "react";
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog";
import { Client } from "@/services/client.service";
import { LocationService, Location } from "@/services/location.service";
import { TaskService, TaskItem } from "@/services/task.service";
import { UserService } from "@/services/user.service";
import { User } from "@/types/user";
import { useUser } from "@/lib/user-context";
import { useDictionary } from "@/lib/dictionary-context";

import { ClientDetailContactCard } from "./ClientDetailContactCard";
import { ClientDetailDialogHeader } from "./ClientDetailDialogHeader";
import { ClientDetailDialogLoading } from "./ClientDetailDialogLoading";
import { ClientDetailDialogTabsSection } from "./ClientDetailDialogTabsSection";
import { ClientDetailManageActions } from "./ClientDetailManageActions";

interface ClientDetailDialogProps {
    client: Client | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onViewLocationTasks: (location: Location) => void;
    onViewTaskDetails: (task: TaskItem) => void;
    onEditClient?: (client: Client) => void;
    onToggleActiveClient?: (client: Client) => void;
    onDeleteClient?: (client: Client) => void;
    canManage?: boolean;
}

export function ClientDetailDialog({
    client,
    open,
    onOpenChange,
    onViewLocationTasks,
    onViewTaskDetails,
    onEditClient,
    onToggleActiveClient,
    onDeleteClient,
    canManage = false,
}: ClientDetailDialogProps) {
    const { user } = useUser();
    const { dict } = useDictionary();

    const [locations, setLocations] = useState<Location[]>([]);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<"locations" | "tasks">("locations");
    const [taskSearch, setTaskSearch] = useState("");
    const [taskStatusFilter, setTaskStatusFilter] = useState<string>("ALL");

    const finishLoading = useEffectEvent((cancelled: boolean) => {
        if (!cancelled) {
            setLoading(false);
        }
    });

    useEffect(() => {
        if (!client || !open) return;
        let cancelled = false;

        const loadDetails = async () => {
            setLoading(true);
            try {
                const locData = await LocationService.getLocations(client.id);
                if (cancelled) return;
                setLocations(locData);

                const tasksPromises = locData.map(loc =>
                    TaskService.getTaskItems({ locationId: loc.id }).catch(() => [] as TaskItem[])
                );
                const tasksArrays = await Promise.all(tasksPromises);
                if (cancelled) return;
                setTasks(tasksArrays.flat());

                const usersData = await UserService.getUsers().catch(() => [] as User[]);
                const filteredUsers = user?.role?.name === "superadmin"
                    ? usersData
                    : usersData.filter(u => u.role?.name !== "superadmin");
                if (cancelled) return;
                setUsers(filteredUsers);
            } catch (err) {
                console.error("Error loading client detailed dashboard", err);
            } finally {
                finishLoading(cancelled);
            }
        };

        void loadDetails();
        return () => {
            cancelled = true;
        };
    }, [client, open, user?.role?.name]);

    if (!client) return null;

    const getAssigneeName = (userId: number | null) => {
        if (userId === null) {
            return "Sin asignar";
        }
        const u = users.find(x => x.id === userId);
        return u ? u.full_name || u.email : `Worker #${userId}`;
    };

    const filteredTasks = tasks.filter(t => {
        const matchesSearch = t.title.toLowerCase().includes(taskSearch.toLowerCase()) ||
            (t.description && t.description.toLowerCase().includes(taskSearch.toLowerCase()));

        const normalizedStatus = t.status.toLowerCase().replaceAll("-", "_");
        const statusGroup =
            normalizedStatus === "completed"
                ? "completed"
                : ["progress", "in_progress", "started"].includes(normalizedStatus)
                  ? "progress"
                  : ["pending", "accepted", "requested", "review"].includes(normalizedStatus)
                    ? "pending"
                    : normalizedStatus;
        const matchesStatus = taskStatusFilter === "ALL" || taskStatusFilter === statusGroup;

        return matchesSearch && matchesStatus;
    });

    const handleClose = () => onOpenChange(false);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl p-0 overflow-hidden max-h-[90vh] sm:max-h-[85vh] flex flex-col text-[var(--text-main)] border border-[var(--border-soft)]">
                <ClientDetailDialogHeader client={client} />

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
                    <ClientDetailContactCard client={client} />

                    {loading ? (
                        <ClientDetailDialogLoading
                            message={dict.clients.details?.loading || "Loading locations and tasks..."}
                        />
                    ) : (
                        <ClientDetailDialogTabsSection
                            activeTab={activeTab}
                            onActiveTabChange={setActiveTab}
                            locations={locations}
                            tasks={tasks}
                            filteredTasks={filteredTasks}
                            taskSearch={taskSearch}
                            onTaskSearchChange={setTaskSearch}
                            taskStatusFilter={taskStatusFilter}
                            onTaskStatusFilterChange={setTaskStatusFilter}
                            getAssigneeName={getAssigneeName}
                            onViewLocationTasks={onViewLocationTasks}
                            onViewTaskDetails={onViewTaskDetails}
                            onClose={handleClose}
                            labels={{
                                locationsTab: dict.clients.details?.locations_tab || "Locations ({count})",
                                tasksTab: dict.clients.details?.tasks_tab || "Tasks / Jobs ({count})",
                                locations: {
                                    no_locations: dict.clients.details?.no_locations,
                                    ver_tareas: dict.clients.details?.ver_tareas,
                                    type_private: dict.locations?.type_private,
                                    type_real_estate: dict.locations?.type_real_estate,
                                    type_business: dict.locations?.type_business,
                                    type_exterior: dict.locations?.type_exterior,
                                    type_other: dict.locations?.type_other,
                                },
                                tasks: {
                                    search_task: dict.clients.details?.search_task,
                                    all_statuses: dict.clients.details?.all_statuses,
                                    status_pending: dict.clients.details?.status_pending,
                                    status_in_progress: dict.clients.details?.status_in_progress,
                                    status_completed: dict.clients.details?.status_completed,
                                    no_tasks: dict.clients.details?.no_tasks,
                                },
                            }}
                        />
                    )}
                </div>

                {canManage && (
                    <ClientDetailManageActions
                        client={client}
                        onEditClient={onEditClient}
                        onToggleActiveClient={onToggleActiveClient}
                        onDeleteClient={onDeleteClient}
                        onClose={handleClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
