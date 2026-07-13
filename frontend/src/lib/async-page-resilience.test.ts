import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const calendarPageSource = readFileSync(
    new URL("../app/dashboard/calendar/page.tsx", import.meta.url),
    "utf8",
);

test("calendar initial async load handles rejection before finishing loading", () => {
    const initialLoad = calendarPageSource.slice(
        calendarPageSource.indexOf("const initialLoad"),
        calendarPageSource.indexOf("return () => window.clearTimeout"),
    );

    assert.match(initialLoad, /loadData\(\)[\s\S]*\.catch\([\s\S]*\.finally\(/);
});
