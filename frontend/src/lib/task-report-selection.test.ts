import assert from "node:assert/strict";
import test from "node:test";

import {
    areAllVisibleReportsSelected,
    canEditTaskReportContent,
    toggleSelectedReportId,
    withVisibleReportsSelection,
} from "../features/task-reports/task-report-selection.ts";

test("toggleSelectedReportId adds and removes without mutating the original set", () => {
    const initial = new Set([1, 2]);
    const withThree = toggleSelectedReportId(initial, 3);
    assert.deepEqual([...withThree].sort((a, b) => a - b), [1, 2, 3]);
    assert.deepEqual([...initial].sort((a, b) => a - b), [1, 2]);

    const withoutTwo = toggleSelectedReportId(withThree, 2);
    assert.deepEqual([...withoutTwo].sort((a, b) => a - b), [1, 3]);
});

test("withVisibleReportsSelection selects or clears only the visible ids", () => {
    const selected = new Set([9, 10]);
    const visible = [1, 2, 3];

    const allVisible = withVisibleReportsSelection(selected, visible, true);
    assert.deepEqual([...allVisible].sort((a, b) => a - b), [1, 2, 3, 9, 10]);

    const clearedVisible = withVisibleReportsSelection(allVisible, visible, false);
    assert.deepEqual([...clearedVisible].sort((a, b) => a - b), [9, 10]);
});

test("areAllVisibleReportsSelected requires every visible id", () => {
    assert.equal(areAllVisibleReportsSelected([1, 2], new Set([1, 2, 9])), true);
    assert.equal(areAllVisibleReportsSelected([1, 2], new Set([1])), false);
    assert.equal(areAllVisibleReportsSelected([], new Set([1])), false);
});

test("canEditTaskReportContent allows text-bearing report types only", () => {
    assert.equal(canEditTaskReportContent("issue"), true);
    assert.equal(canEditTaskReportContent("note"), true);
    assert.equal(canEditTaskReportContent("checklist_note"), true);
    assert.equal(canEditTaskReportContent("photo"), false);
    assert.equal(canEditTaskReportContent("checklist_photo"), false);
});
