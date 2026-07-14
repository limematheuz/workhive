import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("tech task photo and note dialogs always expose create controls", () => {
    const attachments = read("../components/dashboard/tech-task/TechTaskAttachmentsDialog.tsx");
    const comments = read("../components/dashboard/tech-task/TechTaskCommentsDialog.tsx");
    const map = read("../components/dashboard/tech-task/TechTaskMapArea.tsx");

    assert.match(attachments, /type="file"/);
    assert.doesNotMatch(attachments, /isCurrentTaskSessionActive/);
    assert.match(comments, /comments_placeholder/);
    assert.doesNotMatch(comments, /isCurrentTaskSessionActive/);
    assert.match(map, /navigate_gps/);
    assert.match(map, /absolute top-4 left-4/);
    assert.doesNotMatch(map, /ArrowLeft|btn_back_to_tasks/);
});

test("tech task details open as a Dialog over the dashboard list", () => {
    const dashboard = read("../components/dashboard/TechDashboard.tsx");
    const details = read("../components/dashboard/TechTaskDetails.tsx");

    assert.match(details, /components\/ui\/dialog/);
    assert.match(details, /overlayClassName/);
    assert.doesNotMatch(details, /showCloseButton=\{false\}/);
    assert.match(dashboard, /openTaskDetail/);
    assert.match(dashboard, /pushState/);
    assert.match(dashboard, /popstate/);
    assert.doesNotMatch(dashboard, /if \(selectedTask\) \{\s*return/);
});
