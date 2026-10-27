import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("work orders have an independent operational service and page", () => {
    const service = read("../services/work-order.service.ts");
    const page = read("../app/dashboard/work-orders/page.tsx");
    const materialsDialog = read("../components/work-orders/WorkOrderMaterialsDialog.tsx");
    const correctionDialog = read("../components/work-orders/WorkOrderMaterialCorrectionDialog.tsx");
    const list = read("../components/work-orders/WorkOrderList.tsx");
    const editor = read("../components/work-orders/EditWorkOrderDialog.tsx");
    const sidebar = read("../components/dashboard/sidebar-nav-config.tsx");

    assert.match(service, /\/api\/v1\/work-orders\//);
    assert.match(service, /contract-candidates/);
    assert.match(service, /generate/);
    assert.match(service, /materials/);
    assert.match(service, /reverseMaterialConsumption/);
    assert.match(page, /WorkOrderList/);
    assert.match(list, /DataListTable/);
    assert.match(page, /Nueva orden/);
    assert.match(list, /Generar tarea/);
    assert.match(list, /ActionPopover/);
    assert.match(editor, /workOrder\.next_occurrence_at \?\? workOrder\.scheduled_start_at/);
    assert.match(editor, /next_occurrence_at: new Date\(draft\.scheduledStart\)\.toISOString\(\)/);
    assert.match(page, /WorkOrderMaterialsDialog/);
    assert.match(materialsDialog, /WorkOrderMaterialCorrectionDialog/);
    assert.doesNotMatch(materialsDialog, /window\.prompt/);
    assert.match(correctionDialog, /Motivo de la corrección/);
    assert.match(correctionDialog, /Corregir consumo/);
    assert.doesNotMatch(correctionDialog, /window\.prompt/);
    assert.match(sidebar, /"\/dashboard\/work-orders"/);
});
