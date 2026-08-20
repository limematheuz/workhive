export const MIN_ACCOUNTANT_EXPORT_YEAR = 2000;
export type AccountantExportPeriod = "year" | "month" | "quarter" | "semester";

function periodSuffix(year: number, period: AccountantExportPeriod, periodNumber?: number): string {
    if (period === "year") {
        if (periodNumber !== undefined) throw new Error("Annual accountant export does not accept a period number");
        return String(year);
    }
    const limits: Record<Exclude<AccountantExportPeriod, "year">, number> = {
        month: 12,
        quarter: 4,
        semester: 2,
    };
    const limit = limits[period];
    if (!Number.isInteger(periodNumber) || !periodNumber || periodNumber < 1 || periodNumber > limit) {
        throw new Error("Accountant export period number is invalid");
    }
    if (period === "month") return `${year}-${String(periodNumber).padStart(2, "0")}`;
    return `${year}-${period === "quarter" ? "T" : "S"}${periodNumber}`;
}

export function accountantExportFilename(
    year: number,
    period: AccountantExportPeriod = "year",
    periodNumber?: number,
): string {
    return `workhive-gestoria-${periodSuffix(year, period, periodNumber)}.zip`;
}

export function accountantExportPath(
    year: number,
    period: AccountantExportPeriod = "year",
    periodNumber?: number,
): string {
    if (!Number.isInteger(year) || year < MIN_ACCOUNTANT_EXPORT_YEAR || year > 2100) {
        throw new Error("Accountant export year is invalid");
    }
    periodSuffix(year, period, periodNumber);
    const query = new URLSearchParams({ year: String(year), period });
    if (periodNumber !== undefined) query.set("period_number", String(periodNumber));
    return `/api/v1/accounting-exports/accountant?${query.toString()}`;
}

export function accountantExportYears(
    currentYear: number,
    count = 5,
): number[] {
    return Array.from({ length: count }, (_, index) => currentYear - index)
        .filter((year) => year >= MIN_ACCOUNTANT_EXPORT_YEAR);
}
