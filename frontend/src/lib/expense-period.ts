const DAY_MS = 24 * 60 * 60 * 1000;

export function getExpenseComparisonRange(month: string): { dateFrom: string; dateTo: string } {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
    if (!match) throw new Error("Invalid expense month");

    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const previousMonthStart = Date.UTC(year, monthIndex - 1, 1);
    const followingMonthStart = Date.UTC(year, monthIndex + 1, 1);

    // Expense dates are shown in the browser's local timezone. Include one
    // boundary day so the local-month filter cannot lose UTC-edge records.
    return {
        dateFrom: new Date(previousMonthStart - DAY_MS).toISOString(),
        dateTo: new Date(followingMonthStart + DAY_MS).toISOString(),
    };
}
