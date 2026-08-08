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

export type InvoiceConceptDescriptionParts = {
    title: string;
    meta: string | null;
    details: string[];
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
    const active = (workers || []).filter((worker) => worker.worked_seconds > 0);
    if (!active.length) return null;
    return active
        .map((worker) => `${worker.user_name} ${formatHours(worker.worked_seconds)}`)
        .join(" · ");
}

export function buildInvoiceTaskDescription(params: {
    title: string;
    locationName?: string | null;
    dateLabel?: string | null;
    task: TaskBillingSource;
    formatHours: (seconds: number) => string;
}): string {
    const meta = [params.locationName, params.dateLabel].filter(Boolean).join(" · ");
    const seconds = resolveTaskPersonSeconds(params.task);
    const workersLine = formatWorkerHoursLine(params.task.workers, params.formatHours);
    const lines = [params.title.trim()];

    if (meta) lines.push(meta);
    lines.push("");

    if (seconds > 0) {
        lines.push(`Tiempo del equipo: ${params.formatHours(seconds)}`);
    }
    if (workersLine) {
        lines.push(workersLine);
    }
    if (params.task.pricing_mode === "hourly") {
        const billing = resolveTaskInvoiceBilling(params.task);
        if (billing.quantity > 0) {
            const hoursLabel = Number.isInteger(billing.quantity)
                ? String(billing.quantity)
                : billing.quantity.toFixed(2).replace(/\.?0+$/, "");
            lines.push(`Cobro: ${hoursLabel} h × ${billing.unitPrice} €/h`);
        }
    }

    return lines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

/** Split a stored concept description into title / meta / detail lines for UI hierarchy. */
export function parseInvoiceConceptDescription(
    description: string,
): InvoiceConceptDescriptionParts {
    const rawLines = description.replace(/\r\n/g, "\n").split("\n");
    const nonEmptyIndexes = rawLines
        .map((line, index) => ({ line: line.trim(), index }))
        .filter((entry) => entry.line.length > 0);

    if (!nonEmptyIndexes.length) {
        return { title: "", meta: null, details: [] };
    }

    const title = nonEmptyIndexes[0]?.line || "";
    const second = nonEmptyIndexes[1];
    const blankAfterTitle = rawLines.findIndex(
        (line, index) => index > (nonEmptyIndexes[0]?.index ?? 0) && line.trim() === "",
    );
    const looksLikeMeta = Boolean(
        second
        && (
            blankAfterTitle === -1
            || second.index < blankAfterTitle
        )
        && !/^(tiempo del equipo|horas-persona|cobro):/i.test(second.line)
    );

    const meta = looksLikeMeta ? second.line : null;
    const detailStartIndex = looksLikeMeta
        ? (second?.index ?? 0) + 1
        : (nonEmptyIndexes[0]?.index ?? 0) + 1;

    const details = rawLines
        .slice(detailStartIndex)
        .map((line) => line.trim())
        .filter(Boolean);

    return { title, meta, details };
}
