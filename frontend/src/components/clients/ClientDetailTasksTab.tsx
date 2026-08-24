"use client";

import { ChevronRight, MapPin, Search, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Location } from "@/services/location.service";
import { TaskItem } from "@/services/task.service";

type ClientDetailTasksTabProps = {
    filteredTasks: TaskItem[];
    locations: Location[];
    taskSearch: string;
    onTaskSearchChange: (value: string) => void;
    taskStatusFilter: string;
    onTaskStatusFilterChange: (value: string) => void;
    getAssigneeName: (userId: number | null) => string;
    labels: {
        search_task?: string;
        all_statuses?: string;
        status_pending?: string;
        status_in_progress?: string;
        status_completed?: string;
        no_tasks?: string;
    };
    onViewTaskDetails: (task: TaskItem) => void;
    onClose: () => void;
};

export function ClientDetailTasksTab({
    filteredTasks,
    locations,
    taskSearch,
    onTaskSearchChange,
    taskStatusFilter,
    onTaskStatusFilterChange,
    getAssigneeName,
    labels,
    onViewTaskDetails,
    onClose,
}: ClientDetailTasksTabProps) {
    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-main)]" />
                    <Input
                        type="text"
                        placeholder={labels.search_task || "Search task..."}
                        value={taskSearch}
                        onChange={e => onTaskSearchChange(e.target.value)}
                        className="pl-8 h-8 text-xs bg-[var(--bg-secondary)] border-[var(--border-soft)]"
                    />
                </div>
                <select
                    value={taskStatusFilter}
                    onChange={e => onTaskStatusFilterChange(e.target.value)}
                    aria-label={labels.all_statuses || "All statuses"}
                    className="h-8 text-xs bg-[var(--bg-secondary)] text-[var(--text-main)] border border-[var(--border-soft)] rounded-lg px-2 outline-none"
                >
                    <option value="ALL">{labels.all_statuses || "All statuses"}</option>
                    <option value="pending">{labels.status_pending || "Pending"}</option>
                    <option value="progress">{labels.status_in_progress || "In progress"}</option>
                    <option value="completed">{labels.status_completed || "Completed"}</option>
                </select>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {filteredTasks.length === 0 ? (
                    <div className="text-center py-8 text-xs font-semibold text-[var(--text-muted)] italic">
                        {labels.no_tasks || "No tasks found with current filters."}
                    </div>
                ) : (
                    filteredTasks.map(task => {
                        const taskLoc = locations.find(l => l.id === task.location_id);
                        return (
                            <div
                                key={task.id}
                                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 gap-2 bg-[var(--bg-secondary)]/30 border border-[var(--border-soft)] rounded-2xl hover:border-[var(--border-color)] transition-colors"
                            >
                                <div className="min-w-0 flex-1 sm:pr-4">
                                    <span className="text-xs font-black text-[var(--text-main)] truncate block">
                                        {task.title}
                                    </span>
                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-3xs font-semibold text-[var(--text-muted)]">
                                        <span className="flex items-center gap-0.5">
                                            <MapPin className="w-2.5 h-2.5 shrink-0 text-accent" />
                                            {taskLoc?.name || `Loc #${task.location_id}`}
                                        </span>
                                        <span>·</span>
                                        <span className="flex items-center gap-0.5">
                                            <UserCheck className="w-2.5 h-2.5 shrink-0 text-accent" />
                                            {getAssigneeName(task.user_id)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <Badge
                                        className={`text-[9px] px-2 py-0.5 font-bold uppercase rounded-full ${
                                            task.status === "completed"
                                                ? "bg-accent/10 text-accent border border-accent/20"
                                                : task.status === "progress"
                                                  ? "bg-accent/10 text-accent border border-accent/20"
                                                  : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20"
                                        }`}
                                    >
                                        {task.status === "completed"
                                            ? (labels.status_completed || "Completadas")
                                            : task.status === "progress"
                                              ? (labels.status_in_progress || "En curso")
                                              : (labels.status_pending || "Pendientes")}
                                    </Badge>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                            onClose();
                                            onViewTaskDetails(task);
                                        }}
                                        className="h-8 w-8 p-0 rounded-xl hover:bg-[var(--bg-tertiary)]"
                                    >
                                        <ChevronRight className="w-4 h-4 text-[var(--text-main)]" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
