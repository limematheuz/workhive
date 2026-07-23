import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Quote } from "@/types/quote";
import { createQuoteClientRegistrationDraft } from "./quote-client-registration.ts";

test("quote client registration pre-fills known billing data without inventing locality", () => {
    const quote = {
        title: "Limpieza mensual",
        custom_recipient_info: [
            "Cliente Nuevo",
            "NIF/CIF: B12345679",
            "Dirección: Calle Cliente 2",
            "Teléfono: +34600999888",
            "Email: cliente@example.com",
        ].join("\n"),
    } as Quote;

    assert.deepEqual(createQuoteClientRegistrationDraft(quote), {
        name: "Cliente Nuevo",
        client_type: "business",
        legal_number: "B12345679",
        email: "cliente@example.com",
        phone: "+34600999888",
        address: "Calle Cliente 2",
        city: "",
        province: null,
        postal_code: "",
        country: "España",
    });
});

test("quote acceptance is centralized and never creates a client in browser hooks", () => {
    const sources = [
        "../hooks/useQuoteDetail.ts",
        "../components/quotes/QuoteDetailSheet.tsx",
    ].map((path) => readFileSync(new URL(path, import.meta.url), "utf8"));
    const service = readFileSync(
        new URL("../services/quote.service.ts", import.meta.url),
        "utf8",
    );

    assert.match(service, /acceptQuote/);
    for (const source of sources) {
        assert.match(source, /QuoteService\.acceptQuote/);
        assert.doesNotMatch(source, /ClientService\.createClient/);
    }
});
