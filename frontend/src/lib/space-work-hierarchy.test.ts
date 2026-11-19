import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildWorkSpaceHierarchy, filterWorkSpaceHierarchy, mergeWorkSpaceSelection, taskSpacesInBranch, workSpaceBranches } from "../domain/locations/space-work-hierarchy.ts";
import type { LocationSpace } from "../types/location.ts";

const fixture: LocationSpace[] = [
    { id: 1, name: "Edificio central", space_type: "other", tasks: [{ id: 11, title: "Entrada", category: "cleaning" }] },
    { id: 2, parent_id: 1, name: "Planta 2", space_type: "other", tasks: [] },
    { id: 3, parent_id: 2, name: "Despacho dirección", space_type: "office", tasks: [{ id: 31, title: "Desinfectar mesas", category: "cleaning", estimated_minutes: 20 }] },
    { id: 4, parent_id: 2, name: "Baño", space_type: "bathroom", tasks: [{ id: 41, title: "Sanitarios", category: "cleaning" }, { id: 42, title: "Archivada", category: "cleaning", is_active: false }] },
    { id: 5, parent_id: 2, name: "Almacén", space_type: "other", tasks: [] },
    { id: 6, parent_id: 1, name: "Planta 3", space_type: "other", tasks: [] },
    { id: 7, parent_id: 6, name: "Despacho", space_type: "office", tasks: [{ id: 71, title: "Aspirar", category: "cleaning" }] },
    { id: 8, parent_id: 2, name: "Archivado", space_type: "office", is_active: false, tasks: [{ id: 81, title: "No incluir", category: "cleaning" }] },
];

test("a floor selects only its task-bearing descendants, excluding other floors and empty containers", () => {
    const nodes = buildWorkSpaceHierarchy(fixture);
    assert.deepEqual(taskSpacesInBranch(nodes, 2), [3, 4]);
    assert.deepEqual(taskSpacesInBranch(nodes, 1), [1, 3, 4, 7]);
    assert.deepEqual(taskSpacesInBranch(nodes, 5), []);
    assert.equal(nodes.find(node => node.space.id === 3)?.breadcrumb, "Edificio central / Planta 2 / Despacho dirección");
    assert.equal(nodes.find(node => node.space.id === 3)?.depth, 2);
    assert.deepEqual(nodes.find(node => node.space.id === 4)?.taskIds, [41]);
});

test("floor and ancestor search includes descendants and preserves hierarchy context", () => {
    const nodes = buildWorkSpaceHierarchy(fixture);
    const floor = filterWorkSpaceHierarchy(nodes, "planta 2");
    assert.deepEqual(floor.filter(item => item.matches).map(item => item.node.space.id), [2, 3, 4, 5]);
    assert.equal(floor.find(item => item.node.space.id === 1)?.matches, false);
    const room = filterWorkSpaceHierarchy(nodes, "direccion");
    assert.deepEqual(room.map(item => item.node.space.id), [1, 2, 3]);
    assert.deepEqual(room.filter(item => item.matches).map(item => item.node.space.id), [3]);
    assert.deepEqual(filterWorkSpaceHierarchy(nodes, "Sanitarios").filter(item => item.matches).map(item => item.node.space.id), [4]);
    assert.deepEqual(filterWorkSpaceHierarchy(nodes, "Archivada"), []);
});

test("filtering a branch never adds its context ancestors to the selected work", () => {
    const nodes = buildWorkSpaceHierarchy(fixture);
    const floor = workSpaceBranches(nodes).find(branch => branch.key === "space:2");
    assert.ok(floor);
    const filtered = filterWorkSpaceHierarchy(nodes, "", floor);
    assert.deepEqual(filtered.filter(item => item.matches && item.node.taskIds.length).map(item => item.node.space.id), [3, 4]);
    assert.equal(filtered.find(item => item.node.space.id === 1)?.matches, false);
});

test("saved flat floor attributes remain searchable and selectable without requiring parent records", () => {
    const nodes = buildWorkSpaceHierarchy([
        { id: 1, name: "Sala A", space_type: "office", attributes: { floor: "Planta baja" }, tasks: [{ id: 1, title: "Mesas", category: "cleaning" }] },
        { id: 2, name: "Sala B", space_type: "office", attributes: { floor: "Planta alta" }, tasks: [{ id: 2, title: "Mesas", category: "cleaning" }] },
        { id: 3, name: "Sala C", space_type: "office", attributes: { floor: 0 }, tasks: [] },
    ]);
    assert.equal(nodes[0].breadcrumb, "Planta baja / Sala A");
    const floor = workSpaceBranches(nodes).find(branch => branch.key === "floor:Planta baja");
    assert.deepEqual(filterWorkSpaceHierarchy(nodes, "", floor).map(item => item.node.space.id), [1]);
    assert.deepEqual(filterWorkSpaceHierarchy(nodes, "planta baja").map(item => item.node.space.id), [1]);
    assert.equal(nodes[2].floor, "0");
});

test("adding a branch preserves customised tasks, workforce and duration and rejects oversized changes atomically", () => {
    const original = { space_id: 3, task_ids: [31], employee_ids: [15], crew_id: null, planned_minutes: 45 };
    const replacement = { ...original, employee_ids: [], planned_minutes: 20 };
    const extra = { space_id: 4, task_ids: [41], employee_ids: [], crew_id: null, planned_minutes: 30 };
    assert.deepEqual(mergeWorkSpaceSelection([original], [replacement, extra]), [original, extra]);
    assert.equal(mergeWorkSpaceSelection([original], [extra], 1), null);
    assert.deepEqual(original.employee_ids, [15]);
});

test("saved ordering, orphaned spaces and cycles are handled without hiding records or looping", () => {
    const nodes = buildWorkSpaceHierarchy([
        { id: 1, parent_id: 2, name: "Uno", space_type: "other" },
        { id: 2, parent_id: 1, name: "Dos", space_type: "other" },
        { id: 3, parent_id: 999, name: "Huérfano", space_type: "other", sort_order: 2 },
        { id: 4, name: "Primero", space_type: "other", sort_order: 1 },
        { name: "Sin guardar", space_type: "other" },
    ]);
    assert.deepEqual(nodes.map(node => node.space.id), [4, 3, 1, 2]);
    assert.equal(new Set(nodes.map(node => node.space.id)).size, 4);
});

test("the shared editor uses project controls and future-scope edits stay behind the service layer", () => {
    const editor = readFileSync(new URL("../components/operations/SpaceWorkforceEditor.tsx", import.meta.url), "utf8");
    const dialog = readFileSync(new URL("../components/work-orders/WorkOrderScopeDialog.tsx", import.meta.url), "utf8");
    assert.ok(editor.includes("mergeWorkSpaceSelection(value, additions)"));
    assert.ok(editor.includes("Filtrar por planta o rama"));
    assert.ok(editor.includes("Configurar espacios y sus tareas"));
    assert.ok(!editor.includes("<select") && !editor.includes("<input"));
    assert.ok(dialog.includes("Solo para próximas ejecuciones"));
    assert.ok(dialog.includes("LocationWorkspaceService.getSpaces"));
    assert.ok(dialog.includes("workforceChoices(order.location_id)"));
    assert.ok(dialog.includes('{ spaces: data.selection }, "PUT"'));
    assert.ok(!dialog.includes("apiFetch") && !dialog.includes("fetch("));
});
