"use client";

import { ChevronRight, MapPin, Search, UserCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListTable } from "@/components/ui/data-list-table";
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
        task?: string;
        assignment?: string;
        open_task?: string;
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

            <DataListTable
                variant="plain"
                className="max-h-[300px] overflow-y-auto pr-1"
                items={filteredTasks}
                getRowKey={(task) => task.id}
                gridClassName="grid-cols-[minmax(13rem,1.25fr)_minmax(10rem,.9fr)_7rem_2.25rem]"
                columns={[
                    { key: "task", label: labels.task || "Task" },
                    { key: "assignment", label: labels.assignment || "Assignment" },
                    { key: "status", label: labels.all_statuses || "Status", className: "text-right" },
                    { key: "open", label: <span className="sr-only">{labels.open_task || "Open task"}</span>, className: "text-right" },
                ]}
                empty={<p className="py-8 text-center text-xs font-semibold text-[var(--text-muted)]">{labels.no_tasks || "No tasks found with current filters."}</p>}
                renderCompactRow={(task) => <TaskRow task={task} locations={locations} getAssigneeName={getAssigneeName} labels={labels} onOpen={() => { onClose(); onViewTaskDetails(task); }} compact />}
                renderDesktopRow={(task) => <TaskRow task={task} locations={locations} getAssigneeName={getAssigneeName} labels={labels} onOpen={() => { onClose(); onViewTaskDetails(task); }} />}
            />
        </div>
    );
}

function TaskRow({
    task,
    locations,
    getAssigneeName,
    labels,
    onOpen,
    compact = false,
}: {
    task: TaskItem;
    locations: Location[];
    getAssigneeName: (userId: number | null) => string;
    labels: ClientDetailTasksTabProps["labels"];
    onOpen: () => void;
    compact?: boolean;
}) {
    const taskLocation = locations.find((location) => location.id === task.location_id);
    const isCompleted = task.status === "completed";
    const statusLabel = isCompleted ? (labels.status_completed || "Completed") : task.status === "progress" ? (labels.status_in_progress || "In progress") : (labels.status_pending || "Pending");
    const statusClassName = isCompleted ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700" : task.status === "progress" ? "border border-accent/20 bg-accent/10 text-accent" : "border border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400";
    const action = <Button size="icon-xs" variant="ghost" onClick={onOpen} aria-label={labels.open_task || "Open task"}><ChevronRight className="h-4 w-4" /></Button>;

    if (compact) {
        return <div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{task.title}</p><p className="mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--text-muted)]"><MapPin className="h-3 w-3 shrink-0 text-accent" />{taskLocation?.name || `#${task.location_id}`}<span>·</span><UserCheck className="h-3 w-3 shrink-0 text-accent" />{getAssigneeName(task.user_id)}</p></div><div className="flex shrink-0 items-center gap-2"><Badge className={`text-[9px] font-bold uppercase ${statusClassName}`}>{statusLabel}</Badge>{action}</div></div>;
    }

    return <><div className="min-w-0"><p className="truncate text-sm font-semibold text-[var(--text-main)]">{task.title}</p><p className="mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--text-muted)]"><MapPin className="h-3 w-3 shrink-0 text-accent" />{taskLocation?.name || `#${task.location_id}`}</p></div><p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-[var(--text-muted)]"><UserCheck className="h-3.5 w-3.5 shrink-0 text-accent" />{getAssigneeName(task.user_id)}</p><div className="flex justify-end"><Badge className={`text-[9px] font-bold uppercase ${statusClassName}`}>{statusLabel}</Badge></div><div className="flex justify-end">{action}</div></>;
}
