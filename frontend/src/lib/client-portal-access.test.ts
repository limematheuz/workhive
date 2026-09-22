import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("client portal access loads after commit and uses the shared active status colors", () => {
    const tab = read("../components/clients/ClientPortalAccessTab.tsx");

    assert.match(tab, /window\.setTimeout\(\(\) => void load\(\), 0\)/);
    assert.match(tab, /window\.clearTimeout\(timer\)/);
    assert.match(tab, /--status-active-bg/);
    assert.doesNotMatch(tab, /emerald-/);
});
