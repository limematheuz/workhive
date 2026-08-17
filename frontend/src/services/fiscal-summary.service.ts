import { apiFetch, assertApiResponseOk } from "@/lib/api";

export type FiscalPeriodSummary = {
    key: string;
    label: string;
    issued_invoice_count: number;
    registered_expense_count: number;
    output_base_amount: number;
    output_vat_amount: number;
    equivalence_surcharge_amount: number;
    registered_expense_base_amount: number;
    registered_input_vat_amount: number;
    estimated_vat_balance: number;
    withheld_irpf_amount: number;
};

export type FiscalSummary = {
    year: number;
    periods: FiscalPeriodSummary[];
    annual: FiscalPeriodSummary;
};

type FiscalPeriodApiResponse = Omit<FiscalPeriodSummary,
    "output_base_amount"
    | "output_vat_amount"
    | "equivalence_surcharge_amount"
    | "registered_expense_base_amount"
    | "registered_input_vat_amount"
    | "estimated_vat_balance"
    | "withheld_irpf_amount"
> & {
    output_base_amount: number | string;
    output_vat_amount: number | string;
    equivalence_surcharge_amount: number | string;
    registered_expense_base_amount: number | string;
    registered_input_vat_amount: number | string;
    estimated_vat_balance: number | string;
    withheld_irpf_amount: number | string;
};

type FiscalSummaryApiResponse = {
    year: number;
    periods: FiscalPeriodApiResponse[];
    annual: FiscalPeriodApiResponse;
};

const AMOUNT_FIELDS = [
    "output_base_amount",
    "output_vat_amount",
    "equivalence_surcharge_amount",
    "registered_expense_base_amount",
    "registered_input_vat_amount",
    "estimated_vat_balance",
    "withheld_irpf_amount",
] as const;

function amount(value: number | string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePeriod(period: FiscalPeriodApiResponse): FiscalPeriodSummary {
    return AMOUNT_FIELDS.reduce<FiscalPeriodSummary>(
        (normalized, field) => ({ ...normalized, [field]: amount(period[field]) }),
        {
            key: period.key,
            label: period.label,
            issued_invoice_count: period.issued_invoice_count,
            registered_expense_count: period.registered_expense_count,
            output_base_amount: 0,
            output_vat_amount: 0,
            equivalence_surcharge_amount: 0,
            registered_expense_base_amount: 0,
            registered_input_vat_amount: 0,
            estimated_vat_balance: 0,
            withheld_irpf_amount: 0,
        },
    );
}

export const FiscalSummaryService = {
    async getSummary(year: number): Promise<FiscalSummary> {
        const response = await apiFetch(`/api/v1/fiscal-summary/?year=${encodeURIComponent(year)}`, {
            method: "GET",
            cache: "no-store",
        });
        await assertApiResponseOk(response, "Error loading fiscal summary");
        const data = await response.json() as FiscalSummaryApiResponse;

        return {
            year: data.year,
            periods: data.periods.map(normalizePeriod),
            annual: normalizePeriod(data.annual),
        };
    },
};
