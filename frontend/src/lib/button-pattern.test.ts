import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("shared buttons use the profile export dimensions and semantic palette", () => {
    const button = read("../components/ui/button-variants.ts");

    assert.match(button, /rounded-xl text-xs font-semibold/);
    assert.match(button, /default: "px-5 py-2.5/);
    assert.match(button, /gap-1\.5 rounded-xl text-xs font-semibold/);
    assert.match(button, /dangerSoft:/);
    assert.match(button, /--btn-primary-bg/);
    assert.match(button, /--btn-secondary-bg/);
    assert.match(button, /--btn-cancel-bg/);
});

test("calendar controls use the shared button sizes and semantic variants", () => {
    const toolbar = read("../components/calendar/CalendarToolbar.tsx");
    const controls = read("../components/calendar/CalendarGoogleControls.tsx");
    const ownership = read("../components/calendar/CalendarOwnershipRequests.tsx");

    assert.match(toolbar, /className="h-10 rounded-xl/);
    assert.match(toolbar, /size="icon"/);
    assert.match(controls, /variant="secondary"/);
    assert.match(controls, /variant="dangerSoft"/);
    assert.match(ownership, /variant="dangerSoft"/);
});

test("mobile task work action floats above the bottom safe area", () => {
    const controls = read("../components/dashboard/tech-task/TechTaskWorkControls.tsx");
    const view = read("../components/dashboard/tech-task/TechTaskDetailsView.tsx");

    assert.match(controls, /h-11 w-full rounded-xl/);
    assert.match(view, /tech-task-details-footer/);
    assert.match(view, /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/);
    assert.match(view, /py-4 sm:px-5 sm:py-5/);
});
