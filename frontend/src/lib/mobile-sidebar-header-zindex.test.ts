import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("mobile sidebar overlay covers the full viewport including header actions", () => {
    const layout = read("../app/dashboard/layout.tsx");
    const header = read("../components/dashboard/DashboardHeader.tsx");

    assert.match(layout, /fixed inset-0 z-30/);
    assert.match(layout, /lg:hidden/);
    assert.doesNotMatch(layout, /top-20/);
    assert.match(header, /relative z-10/);
    assert.doesNotMatch(header, /z-\[55\]/);
    assert.match(header, /NotificationPanel/);
    assert.match(header, /UserAvatar/);
});
