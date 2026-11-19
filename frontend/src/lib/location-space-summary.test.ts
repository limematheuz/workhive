import assert from "node:assert/strict";
import test from "node:test";
import { locationTaskEstimate } from "../domain/locations/location-setup.ts";
import type { LocationSpace } from "../types/location.ts";

test("location totals combine every space and exclude inactive tasks", () => {
    const spaces: LocationSpace[] = [
        { name: "Baño 1", space_type: "bathroom", tasks: [
            { category: "cleaning", title: "Limpiar WC", estimated_minutes: 8 },
            { category: "cleaning", title: "Fregar suelo", estimated_minutes: 5 },
            { category: "cleaning", title: "Tarea desactivada", estimated_minutes: 90, is_active: false },
        ] },
        { name: "Despacho 1", space_type: "office", tasks: [
            { category: "cleaning", title: "Limpiar mesas", estimated_minutes: 4 },
            { category: "cleaning", title: "Limpiar cristales" },
        ] },
        { name: "Almacén", space_type: "warehouse", tasks: [] },
    ];
    assert.deepEqual(locationTaskEstimate([spaces[0]]), { tasks: 2, minutes: 13, unestimated: 0 });
    assert.deepEqual(locationTaskEstimate([spaces[1]]), { tasks: 2, minutes: 4, unestimated: 1 });
    assert.deepEqual(locationTaskEstimate(spaces), { tasks: 4, minutes: 17, unestimated: 1 });
});

test("unconfigured time remains pending instead of being fabricated", () => {
    assert.deepEqual(locationTaskEstimate([{ name: "Recepción", space_type: "reception", tasks: [{ category: "cleaning", title: "Limpiar entrada" }] }]), { tasks: 1, minutes: 0, unestimated: 1 });
    assert.deepEqual(locationTaskEstimate([]), { tasks: 0, minutes: 0, unestimated: 0 });
});
