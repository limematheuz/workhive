import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
    new URL("../services/client.service.ts", import.meta.url),
    "utf8",
);

test("client contact requests keep API errors actionable", () => {
    for (const method of [
        "getClientContacts",
        "createClientContact",
        "updateClientContact",
        "deactivateClientContact",
    ]) {
        assert.match(source, new RegExp(`${method}: async`));
    }
    assert.match(source, /assertApiResponseOk\(response, "No se pudieron cargar los contactos"\)/);
    assert.match(source, /assertApiResponseOk\(response, "No se pudo crear el contacto"\)/);
    assert.match(source, /assertApiResponseOk\(response, "No se pudo actualizar el contacto"\)/);
    assert.match(source, /assertApiResponseOk\(response, "No se pudo desactivar el contacto"\)/);
});

test("optional client selectors stay empty when the user cannot read clients", () => {
    assert.match(source, /getClients: async/);
    assert.match(source, /if \(response\.status === 403\) \{\s*return \[\]/);
    assert.match(source, /assertApiResponseOk\(response, "No se pudieron cargar los clientes"\)/);
});
