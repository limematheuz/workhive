import {
    normalizeTaskStatus,
} from "../domain/tasks/task-status.ts";
import type { TaskStatus } from "../types/task.ts";

const currencyFormatter = new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
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

function padDatePart(value: number): string {
    return value.toString().padStart(2, "0")
}

export function toLocalDateInput(dateStr: string | null | undefined): string {
    if (!dateStr) return ""
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return ""
    return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

export function toLocalTimeInput(dateStr: string | null | undefined, fallback = "12:00"): string {
    if (!dateStr) return fallback
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return fallback
    return `${padDatePart(date.getHours())}:${padDatePart(date.getMinutes())}`
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
        match[1]
            .split(",")
            .map(value => Number.parseInt(value.trim(), 10))
            .filter(Number.isFinite)
            .forEach(value => ids.add(value));
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

export function getUserChecklistItems(task: FormattableTask | null | undefined, userId: number): ParsedChecklistItem[] {
    const checklist = parseChecklistItems(task?.description);
    if (checklist.length === 0) return [];

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
    if (task?.user_id === userId) return true;
    if (parseTaskAssigneeIds(task?.description).includes(userId)) return true;
    return parseChecklistItems(task?.description).some(item => item.assignedUserId === userId);
}

export function getUserTaskStatus(task: FormattableTask | null | undefined, userId: number): UserTaskStatus {
    const taskStatus = normalizeTaskStatus(task?.status);
    if (taskStatus === "completed") return "completed";

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
