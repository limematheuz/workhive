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
    assert.match(map, /Abrir en Maps/);
    assert.doesNotMatch(map, /<iframe/);
    assert.doesNotMatch(map, /ArrowLeft|btn_back_to_tasks/);
});

test("tech task details open as a Dialog over the dashboard list", () => {
    const dashboard = read("../components/dashboard/TechDashboard.tsx");
    const details = read("../components/dashboard/TechTaskDetails.tsx");

    assert.match(details, /components\/ui\/dialog/);
    assert.match(details, /overlayClassName/);
    assert.match(details, /tech-task-details-overlay/);
    assert.match(details, /tech-task-details-dialog/);
    assert.doesNotMatch(details, /showCloseButton=\{false\}/);
    // relative on DialogContent can strip fixed via tailwind-merge — keep modal openable
    assert.doesNotMatch(details, /className="[^"]*\brelative\b/);
    assert.match(dashboard, /openTaskDetail/);
    assert.match(dashboard, /pushState/);
    assert.match(dashboard, /popstate/);
    assert.doesNotMatch(dashboard, /if \(selectedTask\) \{\s*return/);
});

test("the map modal isolates its scroll surface from expensive glass repainting", () => {
    const map = read("../components/dashboard/tech-task/TechTaskMapArea.tsx");
    const view = read("../components/dashboard/tech-task/TechTaskDetailsView.tsx");
    const globals = read("../app/globals.css");

    assert.match(map, /tech-task-map-area/);
    assert.doesNotMatch(map, /<iframe/);
    assert.match(view, /tech-task-details-scroll/);
    assert.match(globals, /tech-task-details-overlay[\s\S]*backdrop-filter:\s*none/);
    assert.match(globals, /tech-task-details-dialog[\s\S]*backdrop-filter:\s*none/);
    assert.match(globals, /tech-task-details-scroll[\s\S]*overscroll-behavior:\s*contain/);
});

test("tech task hero uses a blurred photo with light/dark scrim and GPS CTA", () => {
    const map = read("../components/dashboard/tech-task/TechTaskMapArea.tsx");
    const globals = read("../app/globals.css");
    const utils = read("../components/dashboard/tech-task/utils.ts");

    assert.match(map, /tech-task-hero-media/);
    assert.match(map, /tech-task-hero-photo|tech-task-hero-fallback/);
    assert.match(map, /tech-task-hero-scrim/);
    assert.match(map, /getLocationHeroFallbackGradient/);
    assert.match(map, /navigate_gps/);
    assert.match(utils, /getLocationHeroFallbackGradient/);
    // Blur on dedicated wrapper (not the Next/Image node); explicit z layers
    assert.match(map, /tech-task-hero-photo[\s\S]*<Image|tech-task-hero-fallback/);
    assert.match(map, /z-\[1\].*tech-task-hero-scrim|tech-task-hero-scrim[\s\S]*z-\[1\]/);
    assert.match(globals, /\.tech-task-hero-photo[\s\S]*filter:\s*blur\(/);
    // Gradient-only scrim (no opaque solid base) so the blurred photo stays visible
    assert.match(globals, /\.tech-task-hero-scrim[\s\S]*background-color:\s*transparent/);
    assert.match(globals, /\.tech-task-hero-scrim[\s\S]*linear-gradient\([\s\S]*rgba\(15,\s*23,\s*42,\s*0\.(2[2-9]|[3-5]\d)/);
    assert.match(globals, /\.light-mode\s+\.tech-task-hero-scrim[\s\S]*background-color:\s*transparent/);
    assert.doesNotMatch(globals, /\.tech-task-hero-scrim[\s\S]{0,200}background-color:\s*rgba\(15,\s*23,\s*42,\s*0\.[5-9]/);
    assert.match(globals, /tech-task-details-dialog[\s\S]*contain:\s*layout;/);
    assert.doesNotMatch(globals, /\.tech-task-map-area[\s\S]{0,120}contain:\s*layout paint/);
});

test("tech task details body reuses billing-block surfaces and sticky work footer", () => {
    const header = read("../components/dashboard/tech-task/TechTaskHeaderInfo.tsx");
    const counters = read("../components/dashboard/tech-task/TechTaskModalCounters.tsx");
    const reservation = read("../components/dashboard/tech-task/TechTaskReservationContext.tsx");
    const issues = read("../components/dashboard/tech-task/TechTaskIssuesSection.tsx");
    const property = read("../components/dashboard/tech-task/TechTaskPropertySection.tsx");
    const view = read("../components/dashboard/tech-task/TechTaskDetailsView.tsx");
    const work = read("../components/dashboard/tech-task/TechTaskWorkControls.tsx");

    assert.match(header, /billing-block/);
    assert.match(header, /components\/ui\/badge/);
    assert.doesNotMatch(header, /VIVIENDA|locationName/);
    assert.match(counters, /billing-block/);
    assert.match(reservation, /billing-block/);
    assert.doesNotMatch(reservation, /border-dashed/);
    assert.match(issues, /billing-block/);
    assert.match(property, /billing-block/);
    assert.match(view, /tech-task-details-footer/);
    assert.doesNotMatch(work, /fixed inset-x-4/);
});
