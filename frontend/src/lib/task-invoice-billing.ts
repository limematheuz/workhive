export type TaskPricingMode = "fixed" | "hourly";

export type InvoiceableWorkerHours = {
    user_id: number;
    user_name: string;
    worked_seconds: number;
    worked_hours: number;
};

export type TaskBillingSource = {
    pricing_mode?: TaskPricingMode | null;
    price?: number | null;
    quantity?: number | null;
    unit?: string | null;
    worked_hours?: number | null;
    worked_seconds?: number | null;
    worked_seconds_snapshot?: number | null;
    workers?: InvoiceableWorkerHours[] | null;
};

/** Preview billing for UI. Backend remains authoritative on invoice create/update. */
export function resolveTaskInvoiceBilling(task: TaskBillingSource): {
    unitPrice: number;
    quantity: number;
} {
    const unitPrice = task.price ?? 0;
    if (task.pricing_mode === "hourly") {
        const hours =
            task.worked_hours
            ?? (task.worked_seconds != null ? task.worked_seconds / 3600 : null)
            ?? (task.worked_seconds_snapshot != null
                ? task.worked_seconds_snapshot / 3600
                : null)
            ?? 0;
        return { unitPrice, quantity: hours };
    }
    return { unitPrice, quantity: task.quantity ?? 1 };
}

export function resolveTaskInvoiceAmount(task: TaskBillingSource): number {
    const { unitPrice, quantity } = resolveTaskInvoiceBilling(task);
    return unitPrice * quantity;
}

export function resolveTaskPersonSeconds(task: TaskBillingSource): number {
    if (typeof task.worked_seconds === "number") return Math.max(0, task.worked_seconds);
    if (typeof task.worked_seconds_snapshot === "number") {
        return Math.max(0, task.worked_seconds_snapshot);
    }
    if (typeof task.worked_hours === "number") {
        return Math.max(0, Math.round(task.worked_hours * 3600));
    }
    return 0;
}

export function formatWorkerHoursLine(
    workers: InvoiceableWorkerHours[] | null | undefined,
    formatHours: (seconds: number) => string,
): string | null {
    if (!workers?.length) return null;
    return workers
        .map((worker) => `${worker.user_name} ${formatHours(worker.worked_seconds)}`)
        .join(" · ");
}

export function buildTaskWorkSummaryLines(
    task: TaskBillingSource,
    formatHours: (seconds: number) => string,
): string[] {
    const seconds = resolveTaskPersonSeconds(task);
    const lines: string[] = [];
    if (seconds > 0) {
        lines.push(`Horas-persona: ${formatHours(seconds)}`);
    }
    const workersLine = formatWorkerHoursLine(task.workers, formatHours);
    if (workersLine) {
        lines.push(workersLine);
    }
    if (task.pricing_mode === "hourly") {
        const billing = resolveTaskInvoiceBilling(task);
        if (billing.quantity > 0) {
            lines.push(`${billing.quantity} h × ${billing.unitPrice} €/h`);
        }
    }
    return lines;
}
