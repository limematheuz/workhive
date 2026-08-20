import { apiFetch, assertApiResponseOk } from "@/lib/api";

export type ClientProfitabilityPeriod = "month" | "year";

export type ClientProfitabilityRow = {
    client_id: number;
    client_name: string;
    invoice_count: number;
    direct_cost_count: number;
    revenue_base_amount: number;
    direct_cost_base_amount: number;
    known_margin_amount: number;
    known_margin_percentage: number | null;
};

export type ClientProfitabilityPeriodSummary = {
    revenue_base_amount: number;
    direct_cost_base_amount: number;
    known_margin_amount: number;
    known_margin_percentage: number | null;
    client_count: number;
    unassigned_expense_base_amount: number;
    unlinked_historical_sales_base_amount: number;
    clients: ClientProfitabilityRow[];
};

export type ClientProfitability = {
    period: ClientProfitabilityPeriod;
    reference_date: string;
    current: ClientProfitabilityPeriodSummary;
    previous: ClientProfitabilityPeriodSummary;
};

type ApiAmount = number | string;

type ApiClientProfitabilityRow = Omit<
    ClientProfitabilityRow,
    "revenue_base_amount" | "direct_cost_base_amount" | "known_margin_amount" | "known_margin_percentage"
> & {
    revenue_base_amount: ApiAmount;
    direct_cost_base_amount: ApiAmount;
    known_margin_amount: ApiAmount;
    known_margin_percentage: ApiAmount | null;
};

type ApiClientProfitabilityPeriodSummary = Omit<
    ClientProfitabilityPeriodSummary,
    "revenue_base_amount"
    | "direct_cost_base_amount"
    | "known_margin_amount"
    | "known_margin_percentage"
    | "unassigned_expense_base_amount"
    | "unlinked_historical_sales_base_amount"
    | "clients"
> & {
    revenue_base_amount: ApiAmount;
    direct_cost_base_amount: ApiAmount;
    known_margin_amount: ApiAmount;
    known_margin_percentage: ApiAmount | null;
    unassigned_expense_base_amount: ApiAmount;
    unlinked_historical_sales_base_amount: ApiAmount;
    clients: ApiClientProfitabilityRow[];
};

type ApiClientProfitability = Omit<ClientProfitability, "current" | "previous"> & {
    current: ApiClientProfitabilityPeriodSummary;
    previous: ApiClientProfitabilityPeriodSummary;
};

function amount(value: ApiAmount): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function nullableAmount(value: ApiAmount | null): number | null {
    return value === null ? null : amount(value);
}

function normalizeRow(row: ApiClientProfitabilityRow): ClientProfitabilityRow {
    return {
        ...row,
        revenue_base_amount: amount(row.revenue_base_amount),
        direct_cost_base_amount: amount(row.direct_cost_base_amount),
        known_margin_amount: amount(row.known_margin_amount),
        known_margin_percentage: nullableAmount(row.known_margin_percentage),
    };
}

export function normalizeClientProfitabilityPeriod(
    summary: ApiClientProfitabilityPeriodSummary,
): ClientProfitabilityPeriodSummary {
    return {
        ...summary,
        revenue_base_amount: amount(summary.revenue_base_amount),
        direct_cost_base_amount: amount(summary.direct_cost_base_amount),
        known_margin_amount: amount(summary.known_margin_amount),
        known_margin_percentage: nullableAmount(summary.known_margin_percentage),
        unassigned_expense_base_amount: amount(summary.unassigned_expense_base_amount),
        unlinked_historical_sales_base_amount: amount(summary.unlinked_historical_sales_base_amount),
        clients: summary.clients.map(normalizeRow),
    };
}

export const ClientProfitabilityService = {
    async getProfitability(
        period: ClientProfitabilityPeriod,
        referenceDate?: string,
    ): Promise<ClientProfitability> {
        const query = new URLSearchParams({ period });
        if (referenceDate) query.set("reference_date", referenceDate);
        const response = await apiFetch(`/api/v1/client-profitability/?${query.toString()}`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "Error loading client profitability");
        const data = await response.json() as ApiClientProfitability;

        return {
            ...data,
            current: normalizeClientProfitabilityPeriod(data.current),
            previous: normalizeClientProfitabilityPeriod(data.previous),
        };
    },
};
