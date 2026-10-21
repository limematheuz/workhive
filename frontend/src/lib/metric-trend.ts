/**
 * Returns the percentage change against a comparable previous value.
 * A percentage has no useful meaning when the previous value is zero, so
 * callers can omit the badge instead of presenting a misleading ±100%.
 */
export function getPercentageChange(current: number, previous: number): number | null {
    if (!Number.isFinite(current) || !Number.isFinite(previous) || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
}

export function getMetricTrend(
    current: number,
    previous: number,
    comparisonDirection?: "higher" | "lower",
) {
    const value = getPercentageChange(current, previous);
    return value === null ? undefined : { value, comparisonDirection };
}

export function getTrendBadgePresentation(
    change: number,
    comparisonDirection: "higher" | "lower" = "higher",
): { value: number; tone: "positive" | "negative" | "neutral" } {
    const value = Math.round(change * 10) / 10 || 0;
    if (value === 0) return { value, tone: "neutral" };
    const favorable = comparisonDirection === "higher" ? value > 0 : value < 0;
    return { value, tone: favorable ? "positive" : "negative" };
}

export function getMonthKey(value: string | Date): string | null {
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function getPreviousMonthKey(month: string): string | null {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
    const [year, monthNumber] = month.split("-").map(Number);
    const date = new Date(Date.UTC(year, monthNumber - 2, 1));
    return getMonthKey(date);
}
