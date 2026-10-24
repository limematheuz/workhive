import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("customer payments support an auditable void from the invoice workspace", () => {
    const service = read("../services/customer-payment.service.ts");
    const section = read("../components/invoices/CustomerPaymentSection.tsx");
    const dialog = read("../components/invoices/CustomerPaymentVoidDialog.tsx");

    assert.match(service, /voidPayment/);
    assert.match(service, /\/api\/v1\/customer-payments\/\$\{paymentId\}\/void/);
    assert.match(section, /CustomerPaymentVoidDialog/);
    assert.match(section, /setPaymentToVoid\(payment\)/);
    assert.match(section, /CustomerPaymentService\.voidPayment/);
    assert.match(dialog, /Motivo de la anulación/);
    assert.match(dialog, /Anular cobro/);
    assert.match(dialog, /no devuelve el dinero recibido ni deshace una rectificación/);
    assert.doesNotMatch(dialog, /volverá a reflejar su saldo pendiente/);
    assert.doesNotMatch(dialog, /window\.prompt/);
});
