import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("PremiumTabs shares adaptive navigation, labels and guarded shadcn selection", () => {
    const source = read("../components/ui/premium-tabs.tsx");
    const labels = read("../components/ui/premium-tab-label.tsx") + read("../components/ui/premium-tab-styles.ts");
    assert.match(source, /useAdaptiveTabs/);
    assert.match(source, /PremiumTabsNavigation/);
    assert.match(source, /bg-\[var\(--bg-primary\)\]\/40/);
    assert.match(source, /<SelectContent data-form-guard-ignore>/);
    assert.match(source, /data-tab-navigation data-form-guard-ignore/);
    assert.match(source, /dict.tabNavigation.change/);
    assert.match(source, /dict.tabNavigation.options/);
    assert.match(source, /aria-hidden="true" inert/);
    assert.match(labels, /text-xs font-bold uppercase tracking-wider/);
    assert.match(labels, /h-3\.5 w-3\.5/);
    assert.match(labels, /gap-1\.5/);
    assert.match(labels, /--btn-cancel-hover-bg/);
    assert.doesNotMatch(source + labels, /bg-red-|shadow-red-/);
    assert.doesNotMatch(source, /lg:hidden|lg:flex|snap-x/);
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
