import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
    return readFileSync(new URL(path, import.meta.url), "utf8");
}

test("task editors reuse local shadcn inputs and selects", () => {
    const pricing = source("../components/tasks/TaskEditPricingSection.tsx");
    const status = source("../components/tasks/TaskEditStatusSection.tsx");
    const reservations = source("../components/tasks/TaskCreateReservationSection.tsx");

    for (const control of [pricing, status, reservations]) {
        assert.match(control, /from "@\/components\/ui\/select"/);
        assert.match(control, /<SelectTrigger/);
        assert.doesNotMatch(control, /<(?:input|select)\b/);
    }

    assert.match(pricing, /from "@\/components\/ui\/input"/);
    assert.match(pricing, /<Input/);
    assert.match(reservations, /NO_RESERVATION_ID/);
    assert.match(reservations, /value === NO_RESERVATION_ID \? "" : value/);
});

test("tech task forms use shared controls and keep native file selection behind Input", () => {
    const checklist = source("../components/dashboard/tech-task/TechTaskChecklistDialog.tsx");
    const extraWork = source("../components/dashboard/tech-task/ChecklistExtraWorkForm.tsx");
    const issues = source("../components/dashboard/tech-task/TechTaskIssuesSection.tsx");
    const property = source("../components/dashboard/tech-task/TechTaskPropertySection.tsx");
    const comments = source("../components/dashboard/tech-task/TechTaskCommentsDialog.tsx");
    const attachments = source("../components/dashboard/tech-task/TechTaskAttachmentsDialog.tsx");

    for (const control of [extraWork, issues, property]) {
        assert.match(control, /from "@\/components\/ui\/input"/);
        assert.match(control, /from "@\/components\/ui\/select"/);
        assert.match(control, /<SelectTrigger/);
        assert.doesNotMatch(control, /<(?:input|select|textarea)\b/);
    }

    for (const control of [comments, attachments]) {
        assert.match(control, /from "@\/components\/ui\/(?:input|textarea)"/);
        assert.doesNotMatch(control, /<(?:input|textarea)\b/);
    }

    assert.match(checklist, /<ChecklistExtraWorkForm/);
    assert.match(checklist, /from "@\/components\/ui\/input"/);
    assert.doesNotMatch(checklist, /<(?:input|select|textarea)\b/);
    assert.match(extraWork, /onAddChecklistItem\(newChecklistQuestion, Number\(newChecklistAssigneeId\)\)/);
    assert.match(property, /onSubmit=\{save\}/);
    assert.doesNotMatch(property, /querySelector|data-tech-features-editor.*closest/);
    assert.doesNotMatch(issues, /(?:amber|red|purple)-/);
});
