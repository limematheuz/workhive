import assert from "node:assert/strict";
import test from "node:test";
import { shouldCollapseTabs, tabLimitForViewport } from "./tab-navigation-layout.ts";

for (const [width, limit] of [[390, 4], [767, 4], [768, 5], [1023, 5], [1024, 6], [1440, 6]]) {
    test(`navigation allows ${limit} tabs at ${width}px and collapses the next`, () => {
        assert.equal(tabLimitForViewport(width), limit);
        const dimensions = { viewportWidth: width, availableWidth: 900, requiredWidth: 800 };
        assert.equal(shouldCollapseTabs({ ...dimensions, count: limit }), false);
        assert.equal(shouldCollapseTabs({ ...dimensions, count: limit + 1 }), true);
    });
}

test("long labels compact when the containing panel is too narrow", () => {
    assert.equal(shouldCollapseTabs({ count: 2, viewportWidth: 1440, availableWidth: 300, requiredWidth: 450 }), true);
    assert.equal(shouldCollapseTabs({ count: 2, viewportWidth: 1440, availableWidth: 500, requiredWidth: 450 }), false);
});

test("measurement tolerates subpixel rounding at the exact fit boundary", () => {
    assert.equal(shouldCollapseTabs({ count: 4, viewportWidth: 390, availableWidth: 340, requiredWidth: 340.5 }), false);
    assert.equal(shouldCollapseTabs({ count: 4, viewportWidth: 390, availableWidth: 340, requiredWidth: 342 }), true);
});
