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

export type InvoiceConceptWorkerPart = {
    name: string;
    time: string;
};

export type InvoiceConceptDescriptionParts = {
    title: string;
    location: string | null;
    date: string | null;
    teamTime: string | null;
    workers: InvoiceConceptWorkerPart[];
    charge: string | null;
    extras: string[];
};

const TEAM_TIME_RE = /^(?:tiempo del equipo|horas-persona):\s*(.+)$/i;
const CHARGE_RE = /^cobro:\s*(.+)$/i;
const WORKER_RE = /^([^:]+):\s*(\d+h(?:\s*\d+m)?|\d+m)$/i;
const DATE_RE = /^\d{1,2}\/\d{1,2}(?:\/\d{2,4})?$/;

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

export function billableHoursFromSeconds(seconds: number): number {
    if (seconds <= 0) return 0;
    return Number((seconds / 3600).toFixed(4));
}

/**
 * Switch a concept between fixed service price and hourly billing.
 * Hours always come from recorded person-seconds when available.
 */
export function applyConceptBillingMode<T extends {
    unitPrice: number;
    quantity: number;
    pricing_mode?: "fixed" | "hourly" | null;
    worked_seconds?: number | null;
}>(
    row: T,
    mode: "fixed" | "hourly",
    options?: { hourlyRate?: number },
): T {
    const seconds = Math.max(0, row.worked_seconds || 0);
    const hours = billableHoursFromSeconds(seconds);
    const currentTotal = Number((row.unitPrice * (row.quantity || 0)).toFixed(2));

    if (mode === "hourly") {
        const rate = options?.hourlyRate
            ?? (row.pricing_mode === "hourly" ? row.unitPrice : 0);
        return {
            ...row,
            pricing_mode: "hourly",
            quantity: hours > 0 ? hours : row.quantity || 1,
            unitPrice: rate,
        };
    }

    return {
        ...row,
        pricing_mode: "fixed",
        quantity: 1,
        unitPrice: currentTotal > 0 ? currentTotal : row.unitPrice,
    };
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
        .map((worker) => `${worker.user_name}: ${formatHours(worker.worked_seconds)}`)
        .join("\n");
}

export function composeInvoiceConceptDescription(parts: {
    title: string;
    location?: string | null;
    date?: string | null;
    teamTime?: string | null;
    workers?: InvoiceConceptWorkerPart[];
    charge?: string | null;
    extras?: string[];
}): string {
    const lines = [parts.title.trim()].filter(Boolean);
    if (parts.location?.trim()) lines.push(parts.location.trim());
    if (parts.date?.trim()) lines.push(parts.date.trim());
    lines.push("");

    if (parts.teamTime?.trim()) {
        lines.push(`Tiempo del equipo: ${parts.teamTime.trim()}`);
    }
    for (const worker of parts.workers || []) {
        if (!worker.name.trim() || !worker.time.trim()) continue;
        lines.push(`${worker.name.trim()}: ${worker.time.trim()}`);
    }
    if (parts.charge?.trim()) {
        lines.push(
            parts.charge.trim().toLowerCase().startsWith("cobro:")
                ? parts.charge.trim()
                : `Cobro: ${parts.charge.trim()}`,
        );
    }
    for (const extra of parts.extras || []) {
        if (extra.trim()) lines.push(extra.trim());
    }

    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildInvoiceTaskDescription(params: {
    title: string;
    locationName?: string | null;
    dateLabel?: string | null;
    task: TaskBillingSource;
    formatHours: (seconds: number) => string;
}): string {
    const seconds = resolveTaskPersonSeconds(params.task);
    const workers = (params.task.workers || [])
        .filter((worker) => worker.worked_seconds > 0)
        .map((worker) => ({
            name: worker.user_name,
            time: params.formatHours(worker.worked_seconds),
        }));

    let charge: string | null = null;
    if (params.task.pricing_mode === "hourly") {
        const billing = resolveTaskInvoiceBilling(params.task);
        if (billing.quantity > 0) {
            const hoursLabel = Number.isInteger(billing.quantity)
                ? String(billing.quantity)
                : billing.quantity.toFixed(2).replace(/\.?0+$/, "");
            charge = `${hoursLabel} h × ${billing.unitPrice} €/h`;
        }
    }

    return composeInvoiceConceptDescription({
        title: params.title,
        location: params.locationName,
        date: params.dateLabel,
        teamTime: seconds > 0 ? params.formatHours(seconds) : null,
        workers,
        charge,
    });
}

function splitLegacyMeta(meta: string): { location: string | null; date: string | null } {
    if (DATE_RE.test(meta)) {
        return { location: null, date: meta };
    }
    const separator = meta.includes(" · ") ? " · " : meta.includes("•") ? "•" : null;
    if (!separator) {
        return { location: meta, date: null };
    }
    const [location, ...rest] = meta.split(separator).map((part) => part.trim());
    const maybeDate = rest.join(separator).trim();
    if (DATE_RE.test(maybeDate)) {
        return { location: location || null, date: maybeDate };
    }
    return { location: meta, date: null };
}

/** Split a stored concept description into structured parts for compact UI. */
export function parseInvoiceConceptDescription(
    description: string,
): InvoiceConceptDescriptionParts {
    const rawLines = description.replace(/\r\n/g, "\n").split("\n");
    const lines = rawLines.map((line) => line.trim()).filter(Boolean);

    if (!lines.length) {
        return {
            title: "",
            location: null,
            date: null,
            teamTime: null,
            workers: [],
            charge: null,
            extras: [],
        };
    }

    const title = lines[0] || "";
    let index = 1;
    let location: string | null = null;
    let date: string | null = null;

    if (lines[index] && !TEAM_TIME_RE.test(lines[index]) && !CHARGE_RE.test(lines[index]) && !WORKER_RE.test(lines[index])) {
        const first = lines[index];
        if (DATE_RE.test(first)) {
            date = first;
            index += 1;
        } else if (first.includes(" · ") || first.includes("•")) {
            const split = splitLegacyMeta(first);
            location = split.location;
            date = split.date;
            index += 1;
        } else {
            location = first;
            index += 1;
            if (lines[index] && DATE_RE.test(lines[index])) {
                date = lines[index];
                index += 1;
            }
        }
    }

    let teamTime: string | null = null;
    let charge: string | null = null;
    const workers: InvoiceConceptWorkerPart[] = [];
    const extras: string[] = [];

    for (; index < lines.length; index += 1) {
        const line = lines[index];
        const teamMatch = line.match(TEAM_TIME_RE);
        if (teamMatch) {
            teamTime = teamMatch[1]?.trim() || null;
            continue;
        }
        const chargeMatch = line.match(CHARGE_RE);
        if (chargeMatch) {
            charge = chargeMatch[1]?.trim() || null;
            continue;
        }
        const workerMatch = line.match(WORKER_RE);
        if (workerMatch) {
            workers.push({
                name: workerMatch[1]?.trim() || "",
                time: workerMatch[2]?.trim() || "",
            });
            continue;
        }
        if (line.includes(" · ")) {
            // Legacy single-line worker dump: "Ana 40m · Bea 1h"
            for (const chunk of line.split(" · ")) {
                const parts = chunk.trim().match(/^(.+?)\s+(\d+h(?:\s*\d+m)?|\d+m)$/i);
                if (parts) {
                    workers.push({ name: parts[1], time: parts[2] });
                } else if (chunk.trim()) {
                    extras.push(chunk.trim());
                }
            }
            continue;
        }
        extras.push(line);
    }

    return { title, location, date, teamTime, workers, charge, extras };
}
