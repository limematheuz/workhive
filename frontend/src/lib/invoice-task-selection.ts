import type { InvoiceableTask } from "@/services/invoice.service";
import { formatHoursShort } from "./format-hours.ts";
import {
    buildTaskWorkSummaryLines,
    resolveTaskInvoiceBilling,
} from "./task-invoice-billing.ts";

export type InvoiceTaskWithLocation = InvoiceableTask & {
    clientId?: number;
    locationName: string;
};

export type InvoiceTaskConcept = {
    id: string;
    description: string;
    unitPrice: number;
    quantity: number;
    taxRate: number;
    task_item_id: number;
};

type PrepareInvoiceTasksParams = {
    fetchedTasks: InvoiceableTask[];
    initialTasks: InvoiceableTask[];
    initialTaskIds: number[];
    selectedClientId: string;
};

export function prepareInvoiceTasks({
    fetchedTasks,
    initialTasks,
    initialTaskIds,
    selectedClientId,
}: PrepareInvoiceTasksParams): {
    availableTasks: InvoiceTaskWithLocation[];
    selectedTaskIds: number[];
} {
    const clientId = Number(selectedClientId);
    if (!Number.isInteger(clientId)) {
        return { availableTasks: [], selectedTaskIds: [] };
    }

    const initialSelection = new Set(initialTaskIds);
    const tasksById = new Map<number, InvoiceableTask>();

    initialTasks.forEach(task => tasksById.set(task.id, task));
    // The API response is authoritative because collaborating companies may
    // have been materialized as clients after the list screen was loaded.
    fetchedTasks.forEach(task => tasksById.set(task.id, task));

    const availableTasks: InvoiceTaskWithLocation[] = [];
    const selectedTaskIds: number[] = [];

    for (const task of tasksById.values()) {
        const taskClientId =
            task.client_id
            ?? (task as InvoiceableTask & { clientId?: number }).clientId;
        if (taskClientId !== clientId) continue;
        if (task.is_invoiced && !initialSelection.has(task.id)) continue;

        availableTasks.push({
            ...task,
            locationName:
                task.location_name
                || (task as InvoiceableTask & { locationName?: string }).locationName
                || "",
        });
        if (initialSelection.has(task.id)) {
            selectedTaskIds.push(task.id);
        }
    }

    return { availableTasks, selectedTaskIds };
}

export function buildInvoiceTaskConcepts(
    tasks: InvoiceTaskWithLocation[],
    selectedTaskIds: number[],
    taxRate: number,
): InvoiceTaskConcept[] {
    const selected = new Set(selectedTaskIds);
    return tasks.flatMap(task => {
        if (!selected.has(task.id)) return [];
        const taskDate = task.date_done || task.created_at;
        const formattedDate = taskDate
            ? new Date(taskDate).toLocaleDateString(
                "es-ES",
                { day: "2-digit", month: "2-digit" },
            )
            : "";
        const billing = resolveTaskInvoiceBilling(task);
        const workLines = buildTaskWorkSummaryLines(task, formatHoursShort);
        return [{
            id: `task-${task.id}`,
            description: [
                task.title,
                task.locationName,
                formattedDate,
                ...workLines,
            ].filter(Boolean).join("\n"),
            unitPrice: billing.unitPrice,
            quantity: billing.quantity,
            taxRate,
            task_item_id: task.id,
        }];
    });
}
