import assert from "node:assert/strict";
import test from "node:test";
import { tasksForLocationSpace } from "../domain/locations/location-task-catalog.ts";
import type { LocationCatalog } from "../types/location.ts";

const catalog: LocationCatalog = { site_types: [], space_library: [
    { id: "bathroom", label: "Baños", name: "Baño", count_key: "bathroom_count", space_type: "bathroom", tasks: ["Limpiar WC", "Desinfectar lavabo"], features: [{ id: "shower", label: "Con ducha", tasks: ["Limpiar ducha", "Limpiar WC."] }] },
    { id: "office", label: "Despachos", name: "Despacho", count_key: "office_count", space_type: "office", tasks: ["Limpiar mesas", "Vaciar papeleras"], features: [] },
] };

test("the task catalog follows the selected space, including its optional characteristics", () => {
    const bathroom = tasksForLocationSpace(catalog, { name: "Baño 1", space_type: "bathroom" });
    assert.deepEqual(bathroom.map(task => task.title), ["Limpiar WC", "Desinfectar lavabo", "Limpiar ducha"]);
    assert.equal(bathroom[2].condition, "Con ducha");
    assert.deepEqual(tasksForLocationSpace(catalog, { name: "Despacho 1", space_type: "office" }).map(task => task.title), ["Limpiar mesas", "Vaciar papeleras"]);
    assert.deepEqual(tasksForLocationSpace(catalog, undefined), []);
    assert.deepEqual(tasksForLocationSpace(catalog, { name: "Otro", space_type: "unknown" }), []);
});

test("explicit catalog template takes precedence over a generic space type", () => {
    assert.equal(tasksForLocationSpace(catalog, { name: "Zona configurada", space_type: "office", attributes: { catalog_template: "bathroom" } })[0].title, "Limpiar WC");
});
