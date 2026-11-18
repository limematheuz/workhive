import { apiFetch, assertApiResponseOk } from "@/lib/api";
import type { CurrencyKind, CurrencyPayload, CurrencyRecord, CurrencyWorkspace } from "@/types/transaction-currency";

export const TransactionCurrencyService = {
    async read(): Promise<CurrencyWorkspace> {
        const response = await apiFetch("/api/v1/transaction-currency", { cache: "no-store" });
        await assertApiResponseOk(response, "No se pudieron cargar las operaciones en moneda original.");
        return response.json();
    },
    async save(kind: CurrencyKind, payload: CurrencyPayload, id?: number): Promise<CurrencyRecord> {
        const response = await apiFetch(`/api/v1/transaction-currency/${kind}${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
        await assertApiResponseOk(response, "No se pudo guardar la operación. Revisa la moneda, los importes y la fecha del cambio.");
        return response.json();
    },
};
