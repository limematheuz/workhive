import type { Reservation } from "@/types/reservation";
import type { TaskPriority } from "@/types/task";
import type { User } from "@/types/user";

export const ALL_WORKERS_VALUE = "__ALL__";

export type TaskServiceContext = "standalone" | "turnover" | "pre_arrival";

export interface TaskCreationSchedule {
    serviceContext: TaskServiceContext;
    priority: TaskPriority;
}

export function getDefaultTaskDate(now = new Date()): string {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function buildTaskPlanningDate(value: string): string | undefined {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!match) return undefined;
    const [, year, month, day] = match;
    const localNoon = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        23,
        59,
        59,
        999,
    );
    if (
        Number.isNaN(localNoon.getTime())
        || localNoon.getFullYear() !== Number(year)
        || localNoon.getMonth() !== Number(month) - 1
        || localNoon.getDate() !== Number(day)
    ) {
        return undefined;
    }
    return localNoon.toISOString();
}

export function getTaskAssigneeId(userId: string): number | null {
    return userId && userId !== ALL_WORKERS_VALUE
        ? Number.parseInt(userId, 10)
        : null;
}

export function getDefaultAssignmentIds(
    selectedUserId: string,
    users: User[],
): string[] {
    if (selectedUserId === ALL_WORKERS_VALUE) {
        return users.map(user => user.id.toString());
    }
    return selectedUserId ? [selectedUserId] : [];
}

export function getTaskCreationSchedule(
    checkoutReservation?: Reservation,
    nextReservation?: Reservation,
): TaskCreationSchedule {
    const serviceContext: TaskServiceContext = checkoutReservation
        ? "turnover"
        : nextReservation
            ? "pre_arrival"
            : "standalone";
    const sameDayTurnover = Boolean(
        checkoutReservation
        && nextReservation
        && new Date(checkoutReservation.check_out_at).toDateString()
            === new Date(nextReservation.check_in_at).toDateString()
    );
    return {
        serviceContext,
        priority: sameDayTurnover
            ? "high"
            : serviceContext === "standalone"
                ? "low"
                : "medium",
    };
}

function getUserAssignment(users: User[], assignedUserId: string): string {
    const targetUser = users.find(user => user.id.toString() === assignedUserId);
    const userName = targetUser ? (targetUser.full_name || targetUser.email) : "";
    return userName ? `(@${assignedUserId}:${userName})` : `(@${assignedUserId})`;
}

export interface BuildChecklistDescriptionParams {
    description: string | null | undefined;
    templateTaskId: number;
    users: User[];
    selectedUserId: string;
    fixedChecklistAssignments: Record<string, string>;
}

export function buildChecklistDescription({
    description,
    templateTaskId,
    users,
    selectedUserId,
    fixedChecklistAssignments,
}: BuildChecklistDescriptionParams): string | null {
    if (!description) return null;

    const allWorkerIds = users.map(user => user.id.toString());
    const defaultAssignmentIds = getDefaultAssignmentIds(selectedUserId, users);
    const hiddenAssigneeIds = new Set<string>();

    const lines = description.split("\n").flatMap((line, index) => {
        const match = line.match(
            /^(\s*[-*]?\s*\[\s*[xX\s]\s*\]\s*)(.+?)(?:\s*\(@\d+(?::[^)]+)?\))?$/,
        );
        if (!match) return [line];

        const prefix = match[1];
        const text = match[2].trim();
        const assignmentValue = fixedChecklistAssignments[`${templateTaskId}-${index}`];
        if (assignmentValue === "unassigned") {
            return [`${prefix}${text}`];
        }

        const shouldAssignAll = assignmentValue === ALL_WORKERS_VALUE
            || (!assignmentValue && selectedUserId === ALL_WORKERS_VALUE);
        if (shouldAssignAll) {
            allWorkerIds.forEach(id => hiddenAssigneeIds.add(id));
            return [`${prefix}${text}`];
        }

        const assignedUserId = assignmentValue || defaultAssignmentIds[0];
        return assignedUserId
            ? [`${prefix}${text} ${getUserAssignment(users, assignedUserId)}`]
            : [`${prefix}${text}`];
    });

    const hiddenMetadata = hiddenAssigneeIds.size > 0
        ? `<!-- workhive_assignees:${Array.from(hiddenAssigneeIds).join(",")} -->\n`
        : "";
    return `${hiddenMetadata}${lines.join("\n")}`;
}
