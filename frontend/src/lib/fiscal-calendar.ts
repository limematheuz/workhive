export type FiscalCalendarPreferences = {
    quarterlyVatEnabled: boolean;
    quarterlyWithholdingEnabled: boolean;
    reminderDays: number;
};

export type FiscalDeadline = {
    id: string;
    model: "303" | "111";
    periodLabel: string;
    dueDate: string;
    reminderDate: string;
};

export type FiscalDeadlineStatus = "planned" | "upcoming" | "overdue";

type Obligation = Pick<FiscalDeadline, "model">;

const QUARTERLY_DUE_DATES = [
    { month: 4, day: 20, dueYearOffset: 0, period: (year: number) => `T1 ${year}` },
    { month: 7, day: 20, dueYearOffset: 0, period: (year: number) => `T2 ${year}` },
    { month: 10, day: 20, dueYearOffset: 0, period: (year: number) => `T3 ${year}` },
    { month: 1, day: 30, dueYearOffset: 1, period: (year: number) => `T4 ${year}` },
] as const;

const MODEL_ORDER: Record<FiscalDeadline["model"], number> = {
    "303": 0,
    "111": 1,
};

function formatIsoDate(date: Date) {
    return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, "0"), String(date.getUTCDate()).padStart(2, "0")].join("-");
}

function dateAtNoonUtc(year: number, month: number, day: number) {
    return new Date(Date.UTC(year, month - 1, day, 12));
}

function buildDeadlinesForObligation(year: number, reminderDays: number, obligation: Obligation) {
    return QUARTERLY_DUE_DATES.map(({ month, day, dueYearOffset, period }) => {
        const dueDate = dateAtNoonUtc(year + dueYearOffset, month, day);
        const reminderDate = new Date(dueDate);
        reminderDate.setUTCDate(reminderDate.getUTCDate() - reminderDays);

        return {
            id: `${obligation.model}-${formatIsoDate(dueDate)}`,
            ...obligation,
            periodLabel: period(year),
            dueDate: formatIsoDate(dueDate),
            reminderDate: formatIsoDate(reminderDate),
        } satisfies FiscalDeadline;
    });
}

export function buildQuarterlyFiscalDeadlines(
    year: number,
    preferences: FiscalCalendarPreferences,
): FiscalDeadline[] {
    const reminderDays = Math.max(1, Math.min(30, preferences.reminderDays));
    const obligations: Obligation[] = [];

    if (preferences.quarterlyVatEnabled) {
        obligations.push({ model: "303" });
    }
    if (preferences.quarterlyWithholdingEnabled) {
        obligations.push({ model: "111" });
    }

    return obligations
        .flatMap((obligation) => buildDeadlinesForObligation(year, reminderDays, obligation))
        .sort(
            (left, right) =>
                left.dueDate.localeCompare(right.dueDate)
                || MODEL_ORDER[left.model] - MODEL_ORDER[right.model],
        );
}

export function buildFiscalCalendarDeadlines(
    calendarYear: number,
    preferences: FiscalCalendarPreferences,
): FiscalDeadline[] {
    /**
     * Show obligations by the year in which they are payable.
     *
     * T4 belongs to the previous tax year but is payable in January, so it
     * remains visible in the following calendar year alongside that year's T1–T3.
     */
    return [
        ...buildQuarterlyFiscalDeadlines(calendarYear - 1, preferences),
        ...buildQuarterlyFiscalDeadlines(calendarYear, preferences),
    ]
        .filter((deadline) => Number(deadline.dueDate.slice(0, 4)) === calendarYear)
        .sort(
            (left, right) => left.dueDate.localeCompare(right.dueDate)
                || MODEL_ORDER[left.model] - MODEL_ORDER[right.model],
        );
}

export function getFiscalDeadlineStatus(
    deadline: FiscalDeadline,
    now = new Date(),
): FiscalDeadlineStatus {
    const today = dateAtNoonUtc(now.getFullYear(), now.getMonth() + 1, now.getDate());
    const dueDate = new Date(`${deadline.dueDate}T12:00:00Z`);
    const reminderDate = new Date(`${deadline.reminderDate}T12:00:00Z`);

    if (dueDate < today) return "overdue";
    if (reminderDate <= today) return "upcoming";
    return "planned";
}
