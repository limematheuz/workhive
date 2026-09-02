import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
    new URL("../services/client.service.ts", import.meta.url),
    "utf8",
);

test("client opportunity requests keep commercial reads and writes in the service layer", () => {
    for (const method of [
        "getClientOpportunities",
        "getClientOpportunityOwners",
        "createClientOpportunity",
        "updateClientOpportunity",
        "getClientOpportunityActivities",
        "createClientOpportunityActivity",
    ]) {
        assert.match(source, new RegExp(`${method}: async`));
    }
    assert.match(source, /assertApiResponseOk\(response, "No se pudieron cargar las oportunidades"\)/);
    assert.match(source, /assertApiResponseOk\(response, "No se pudo cargar el historial comercial"\)/);
    assert.match(source, /assertApiResponseOk\(response, "No se pudo guardar la actividad comercial"\)/);
});
