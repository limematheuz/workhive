import type { TaskItem } from "@/types/user";

export interface OperationsChartStats {
    labels: string[];
    total: number[];
    completed: number[];
    pending: number[];
    overdue: number[];
    requested: number[];
    rejected: number[];
    hasData: boolean;
}

function parseDate(value?: string | null) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function monthIndex(date: Date, startYear: number, startMonth: number) {
    return (date.getFullYear() - startYear) * 12 + date.getMonth() - startMonth;
}

export function buildCompanyTaskStats(
    tasks: TaskItem[],
    locale: "en" | "es",
    now = new Date(),
): OperationsChartStats {
    const firstMonth = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const labels = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(firstMonth.getFullYear(), firstMonth.getMonth() + index, 1);
        return date.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { month: "short" });
    });
    const stats = {
        labels,
        total: Array(6).fill(0) as number[],
        completed: Array(6).fill(0) as number[],
        pending: Array(6).fill(0) as number[],
        overdue: Array(6).fill(0) as number[],
        requested: Array(6).fill(0) as number[],
        rejected: Array(6).fill(0) as number[],
        hasData: false,
    };

    tasks.forEach((task) => {
        const status = task.status.toLowerCase().replaceAll("-", "_");
        const deadline = parseDate(task.due_at || task.scheduled_start_at);
        const isOverdue = status !== "completed" && deadline !== null && deadline < now;
        const eventDate = status === "completed"
            ? parseDate(task.date_done) || parseDate(task.updated_at) || parseDate(task.created_at)
            : isOverdue
                ? deadline
                : parseDate(task.created_at);
        if (!eventDate) return;
        const index = monthIndex(eventDate, firstMonth.getFullYear(), firstMonth.getMonth());
        if (index < 0 || index >= 6) return;

        stats.total[index] += 1;
        if (status === "completed") stats.completed[index] += 1;
        else if (status === "requested") stats.requested[index] += 1;
        else if (status === "rejected" || status === "cancelled") stats.rejected[index] += 1;
        else if (isOverdue) stats.overdue[index] += 1;
        else stats.pending[index] += 1;
    });
    stats.hasData = stats.total.some((value) => value > 0);
    return stats;
}
