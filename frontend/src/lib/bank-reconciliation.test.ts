import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../services/bank-reconciliation.service.ts", import.meta.url), "utf8");

test("bank reconciliation turns failed API responses into safe actionable errors", () => {
    assert.match(source, /import \{ apiFetch, assertApiResponseOk \} from "@\/lib\/api"/);
    assert.match(source, /assertApiResponseOk\(response, "No se pudieron cargar los apuntes bancarios"\)/);
    assert.match(source, /assertApiResponseOk\(response, "No se pudo registrar el apunte bancario"\)/);
    assert.match(source, /assertApiResponseOk\(response, "No se pudo conciliar el apunte bancario"\)/);
    assert.match(source, /assertApiResponseOk\(response, "No se pudo deshacer la conciliación"\)/);
});
