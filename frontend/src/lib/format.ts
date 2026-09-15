import {
    normalizeTaskStatus,
} from "../domain/tasks/task-status.ts";
import type { TaskStatus } from "../types/task.ts";

const currencyFormatter = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
})

const spanishDateTimeFormatter = new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
})

export function formatCurrency(amount: number): string {
    return currencyFormatter.format(amount)
}

export function formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return "-"
    try {
        return new Date(dateStr).toLocaleDateString("es-ES", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        })
    } catch {
        return dateStr ?? "-"
    }
}

export function formatDateLong(dateStr: string | null | undefined, locale = "es-ES"): string {
    if (!dateStr) return "-"
    try {
        return new Date(dateStr).toLocaleDateString(locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
        })
    } catch {
        return dateStr ?? "-"
    }
}

export function formatSpanishDateTime(value: string): string {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : spanishDateTimeFormatter.format(date)
}

export function buildLocalDateTimeIso(dateValue: string, timeValue: string): string | null {
    if (!dateValue) return null
    const date = new Date(`${dateValue}T${timeValue || "12:00"}:00`)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function stripWorkhiveMetadata(desc: string | null | undefined): string {
    if (!desc) return "";
    return desc
        .replace(/<!-- workhive_meta: ([\s\S]*?) -->/g, "")
        .replace(/<!-- workhive_assignees:([\s\S]*?) -->/g, "")
        .trim();
}

export function parseTaskAssigneeIds(desc: string | null | undefined): number[] {
    if (!desc) return [];
    const ids = new Set<number>();
    for (const match of desc.matchAll(/<!-- workhive_assignees:([\s\S]*?) -->/g)) {
        for (const rawValue of match[1].split(",")) {
            const value = Number.parseInt(rawValue.trim(), 10);
            if (Number.isFinite(value)) ids.add(value);
        }
    }
    return Array.from(ids);
}

export function cleanChecklistDescription(desc: string | null | undefined): string {
    if (!desc) return "";
    const cleanDesc = stripWorkhiveMetadata(desc);
    const lines = cleanDesc.split("\n");
    const items: string[] = [];
    lines.forEach(line => {
        const match = line.match(/^\s*[-*]?\s*\[\s*[xX\s]\s*\]\s*(.+?)(?:\s*\(@\d+.*?\))?$/);
        if (match) {
            items.push(match[1].trim());
        } else {
            const cleanLine = line.replace(/^\s*[-*]\s+/, "").trim();
            if (cleanLine) items.push(cleanLine);
        }
    });
    if (items.length === 0) return cleanDesc.trim();
    return items.join(" • ");
}

export interface InstructionContent {
    summary: string;
    items: string[];
}

export function parseInstructionContent(desc: string | null | undefined): InstructionContent {
    if (!desc) return { summary: "", items: [] };

    const cleanDesc = stripWorkhiveMetadata(desc);
    const summaryLines: string[] = [];
    const items: string[] = [];

    cleanDesc.split("\n").forEach((line) => {
        const checklistMatch = line.match(
            /^\s*[-*]?\s*\[\s*[xX\s]\s*\]\s*(.+?)(?:\s*\(@\d+(?::[^)]+)?\))?\s*$/
        );
        if (checklistMatch) {
            items.push(checklistMatch[1].trim());
            return;
        }

        const plainItemMatch = line.match(/^\s*[-*]\s+(.+?)\s*$/);
        if (plainItemMatch) {
            items.push(plainItemMatch[1].trim());
            return;
        }

        const cleanLine = line.trim();
        if (cleanLine) summaryLines.push(cleanLine);
    });

    return {
        summary: summaryLines.join(" "),
        items,
    };
}

export type UserTaskStatus = TaskStatus;

export interface ParsedChecklistItem {
    structuredId?: number;
    text: string;
    checked: boolean;
    assignedUserId?: number;
    assignedUserName?: string;
    assignedStatus?: UserTaskStatus;
    lineIndex: number;
}

interface FormattableTask {
    description?: string | null;
    user_id?: number | null;
    status?: string | null;
    checklist_items?: Array<{
        id: number;
        position: number;
        text: string;
        completed: boolean;
        assignments: Array<{
            user_id: number;
            user_name: string;
            status: string;
        }>;
    }>;
    assignments?: Array<{
        user_id: number;
        user_name: string;
        status: string;
        source: string;
    }>;
}

function parseAssigneeMeta(meta: string | undefined): { name?: string; status?: UserTaskStatus } {
    if (!meta) return {};

    const parts = meta.split(":").flatMap(part => {
        const trimmed = part.trim();
        return trimmed ? [trimmed] : [];
    });
    const possibleStatus = normalizeTaskStatus(parts[parts.length - 1]);
    if (parts.length > 0 && possibleStatus !== "pending") {
        return {
            name: parts.slice(0, -1).join(":") || undefined,
            status: possibleStatus,
        };
    }

    return {
        name: meta.trim() || undefined,
    };
}

export function parseChecklistItems(desc: string | null | undefined): ParsedChecklistItem[] {
    if (!desc) return [];

    const cleanDesc = stripWorkhiveMetadata(desc);
    const lines = cleanDesc.split("\n");
    const items: ParsedChecklistItem[] = [];
    lines.forEach((line, lineIndex) => {
        const match = line.match(/^\s*[-*]?\s*\[\s*([xX\s])\s*\]\s*(.+?)(?:\s*\(@(\d+)(?::([^)]+))?\))?\s*$/);
        if (!match) return;

        const meta = parseAssigneeMeta(match[4]);
        items.push({
            text: match[2].trim(),
            checked: match[1].toLowerCase() === "x",
            assignedUserId: match[3] ? parseInt(match[3], 10) : undefined,
            assignedUserName: meta.name,
            assignedStatus: meta.status,
            lineIndex,
        });
    });

    return items;
}

export function parseTaskChecklistItems(
    task: FormattableTask | null | undefined,
): ParsedChecklistItem[] {
    if (task?.checklist_items !== undefined) {
        return [...task.checklist_items]
            .sort((left, right) => left.position - right.position)
            .map(item => {
                const assignment = item.assignments[0];
                return {
                    structuredId: item.id,
                    text: item.text,
                    checked: item.completed,
                    assignedUserId: assignment?.user_id,
                    assignedUserName: assignment?.user_name,
                    assignedStatus: assignment
                        ? normalizeTaskStatus(assignment.status)
                        : undefined,
                    lineIndex: item.position,
                };
            });
    }
    return parseChecklistItems(task?.description);
}

export function getUserChecklistItems(task: FormattableTask | null | undefined, userId: number): ParsedChecklistItem[] {
    const checklist = parseTaskChecklistItems(task);
    if (checklist.length === 0) return [];

    if (task?.checklist_items !== undefined) {
        const directItems = task.checklist_items.filter(item =>
            item.assignments.some(assignment => assignment.user_id === userId)
        );
        if (directItems.length > 0) {
            const directIds = new Set(directItems.map(item => item.id));
            return checklist.filter(item => (
                item.structuredId !== undefined && directIds.has(item.structuredId)
            ));
        }
        const assignment = task.assignments?.find(item => item.user_id === userId);
        if (assignment?.source === "all") return checklist;
        if (assignment?.source === "direct") {
            const unassignedIds = new Set<number>();
            for (const item of task.checklist_items) {
                if (item.assignments.length === 0) unassignedIds.add(item.id);
            }
            return checklist.filter(item => (
                item.structuredId !== undefined && unassignedIds.has(item.structuredId)
            ));
        }
        return [];
    }

    const assignedToUser = checklist.filter(item => item.assignedUserId === userId);
    if (assignedToUser.length > 0) return assignedToUser;

    if (parseTaskAssigneeIds(task?.description).includes(userId)) {
        return checklist;
    }

    const hasExplicitAssignments = checklist.some(item => item.assignedUserId);
    if (task?.user_id === userId) {
        return hasExplicitAssignments
            ? checklist.filter(item => !item.assignedUserId)
            : checklist;
    }

    return [];
}

export function isTaskAssignedToUser(task: FormattableTask | null | undefined, userId: number): boolean {
    if (task?.assignments !== undefined) {
        return task.assignments.some(assignment => assignment.user_id === userId);
    }
    if (task?.user_id === userId) return true;
    if (parseTaskAssigneeIds(task?.description).includes(userId)) return true;
    return parseChecklistItems(task?.description).some(item => item.assignedUserId === userId);
}

export function getUserTaskStatus(task: FormattableTask | null | undefined, userId: number): UserTaskStatus {
    const taskStatus = normalizeTaskStatus(task?.status);
    if (taskStatus === "completed") return "completed";

    if (task?.assignments !== undefined) {
        const assignment = task.assignments.find(item => item.user_id === userId);
        return assignment ? normalizeTaskStatus(assignment.status) : "pending";
    }

    const directlyAssignedItems = parseChecklistItems(task?.description)
        .filter(item => item.assignedUserId === userId);

    if (directlyAssignedItems.length > 0) {
        const statuses = directlyAssignedItems.flatMap(item => (item.assignedStatus ? [item.assignedStatus] : []));
        if (statuses.includes("rejected")) return "rejected";
        if (statuses.includes("progress")) return "progress";
        if (directlyAssignedItems.every(item => item.assignedStatus === "completed" || item.checked)) return "completed";
        if (statuses.includes("accepted")) return "accepted";
        return "pending";
    }

    if (parseTaskAssigneeIds(task?.description).includes(userId)) return taskStatus;

    if (task?.user_id === userId) return taskStatus;

    return "pending";
}

export function setChecklistAssigneeStatus(
    desc: string | null | undefined,
    userId: number,
    nextStatus: UserTaskStatus,
): { description: string; updatedCount: number } {
    const lines = (desc || "").split("\n");
    let updatedCount = 0;

    const updatedLines = lines.map(line => {
        const match = line.match(/^(\s*[-*]?\s*\[\s*[xX\s]\s*\]\s*)(.+?)(?:\s*\(@(\d+)(?::([^)]+))?\))?\s*$/);
        if (!match || !match[3] || parseInt(match[3], 10) !== userId) return line;

        updatedCount++;
        const meta = parseAssigneeMeta(match[4]);
        const name = meta.name ? `:${meta.name}` : "";
        return `${match[1]}${match[2].trim()} (@${userId}${name}:${nextStatus})`;
    });

    return {
        description: updatedLines.join("\n"),
        updatedCount,
    };
}
export function formatInvoiceNumber(num: string | null | undefined): string {
    if (!num) return ""
    const trimmed = num.trim()
    const upper = trimmed.toUpperCase()
    if (upper.startsWith("INV-") || upper.startsWith("R-") || upper.startsWith("DRAFT-")) {
        return trimmed
    }
    if (!/^\d+$/.test(trimmed)) {
        return trimmed
    }
    return `INV-${trimmed}`
}

export function formatQuoteNumber(num: string | null | undefined): string {
    if (!num) return ""
    const trimmed = num.trim()
    if (trimmed.toUpperCase().startsWith("PRES-")) {
        return trimmed.replace(/^PRES-/i, "QUO-")
    }
    if (trimmed.toUpperCase().startsWith("QUO-")) {
        return trimmed
    }
    return `QUO-${trimmed}`
}
