import type { TaskItem } from "@/types/user";

export type CalendarKanbanChecklistItem = {
    text: string;
    checked: boolean;
    assignedUserId?: number;
    assignedUserName?: string;
};

export function parseCalendarKanbanChecklist(
    description: string | null | undefined,
): CalendarKanbanChecklistItem[] {
    return (description || "").split("\n").flatMap((line) => {
        const match = line.match(
            /^\s*[-*]?\s*\[\s*([xX\s])\s*\]\s*(.+?)(?:\s*\(@(\d+)(?::([^)]+))?\))?$/,
        );
        return match ? [{
            text: match[2].trim(),
            checked: match[1].toLowerCase() === "x",
            assignedUserId: match[3] ? Number.parseInt(match[3], 10) : undefined,
            assignedUserName: match[4] || undefined,
        }] : [];
    });
}

function initialsFor(name: string): string {
    return name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

type CalendarKanbanAssignee = {
    name: string;
    initials: string;
    label: string;
    backgroundClass: string;
};

export function getCalendarKanbanAssignee(
    task: TaskItem,
    getUserFullName: (userId: number | null) => string,
    getUserInitials: (userId: number | null) => {
        initials: string;
        bgColor: string;
    },
    acceptedByLabel: string,
): CalendarKanbanAssignee {
    const fallbackIdentity = getUserInitials(task.user_id);
    const teamNames = Array.from(new Set(
        (task.assignments || []).flatMap((assignment) =>
            assignment.user_name ? [assignment.user_name] : [],
        ),
    ));
    const teamName = teamNames.length === 1
        ? teamNames[0]
        : teamNames.length > 1
            ? `Equipo (${teamNames.length})`
            : null;
    const name = task.accepted_by_name
        || (task.user_id !== null ? getUserFullName(task.user_id) : teamName)
        || "Sin responsable directo";
    const initials = task.accepted_by_name || teamName
        ? initialsFor(task.accepted_by_name || teamName || name)
        : fallbackIdentity.initials;

    return {
        name,
        initials,
        label: task.accepted_by_name
            ? `${acceptedByLabel} ${name}`
            : teamName && task.user_id === null
                ? `Asignada a ${name}`
                : name,
        backgroundClass: fallbackIdentity.bgColor,
    };
}
