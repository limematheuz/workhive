import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("PremiumTabs shell matches Vigentes bar metrics", () => {
    const source = read("../components/ui/premium-tabs.tsx");

    assert.match(source, /bg-\[var\(--bg-primary\)\]\/40/);
    assert.doesNotMatch(source, /dialog-control-bg/);
    assert.match(source, /layout\s*=\s*"fit"/);
    assert.match(source, /text-xs font-bold uppercase tracking-wider/);
    assert.doesNotMatch(source, /text-\[10px\] font-bold uppercase tracking-wider/);
    assert.match(source, /h-3\.5 w-3\.5/);
    assert.doesNotMatch(source, /md:h-4 md:w-4/);
    assert.match(source, /gap-1\.5 px-2 sm:gap-2 sm:px-3/);
});

test("ReservationsFilters reuses PremiumTabs for Vigentes/Historial", () => {
    const source = read("../features/reservations/ReservationsFilters.tsx");

    assert.match(source, /<PremiumTabs/);
    assert.match(source, /layout="fit"/);
    assert.match(source, /ArrowUpRight/);
    assert.match(source, /History/);
    assert.match(source, /billing-block/);
    assert.doesNotMatch(source, /flex bg-\[var\(--bg-primary\)\]\/40 p-1 border/);
});

test("body uses system --font-sans and layout does not import next/font", () => {
    const globals = read("../app/globals.css");
    const layout = read("../app/layout.tsx");

    assert.match(globals, /--font-sans:\s*system-ui/);
    assert.match(globals, /font-family:\s*var\(--font-sans\)/);
    assert.doesNotMatch(layout, /next\/font/);
    assert.doesNotMatch(layout, /from ["']next\/font/);
});
