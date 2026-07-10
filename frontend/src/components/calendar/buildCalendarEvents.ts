import type { EventInput } from "@fullcalendar/core";

import { getTaskCalendarRange } from "@/lib/company-calendar";
import { parseChecklistItems, parseTaskAssigneeIds } from "@/lib/format";
import { isExternalTaskForCompany, taskLocationTitle } from "@/lib/task-display";
import { normalizeTaskStatus } from "@/domain/tasks/task-status";
import type { TaskItem } from "@/types/user";
import type { CalendarEventProps } from "./CalendarEventContent";
import { getCalendarStatusColor } from "./calendar-constants";

export function resolveTaskWorkerNames(
    task: TaskItem,
    userName: (id: number | null | undefined) => string,
    unassignedLabel: string,
): string {
    if (task.user_id) return userName(task.user_id);

    const assignedIds = Array.from(new Set(
        [
            ...parseTaskAssigneeIds(task.description),
            ...parseChecklistItems(task.description).flatMap(item => (
                item.assignedUserId ? [item.assignedUserId] : []
            )),
        ]
    ));

    if (assignedIds.length === 0) return unassignedLabel;
    return assignedIds.map(userName).join(", ");
}

export function buildCalendarEvents(
    tasks: TaskItem[],
    companyId: number | null | undefined,
    locationName: (id: number) => string,
    taskWorkerNames: (task: TaskItem) => string,
): EventInput[] {
    return tasks.flatMap((task) => {
        const range = getTaskCalendarRange(task);
        if (!range) return [];
        const normalizedStatus = normalizeTaskStatus(task.status);
        const color = getCalendarStatusColor(task.status);
        const isExternal = isExternalTaskForCompany(task, companyId);
        return [{
            id: String(task.id),
            title: taskLocationTitle(task, locationName(task.location_id)),
            start: range.start.toISOString(),
            end: range.end.toISOString(),
            backgroundColor: color,
            borderColor: color,
            textColor: "#ffffff",
            classNames: [
                "workhive-calendar-event",
                `workhive-calendar-event-${normalizedStatus}`,
                ...(isExternal ? ["workhive-calendar-event-external"] : []),
            ],
            extendedProps: {
                locationName: locationName(task.location_id),
                userName: taskWorkerNames(task),
                status: normalizedStatus,
                isExternal,
            } satisfies CalendarEventProps,
        }];
    });
}
