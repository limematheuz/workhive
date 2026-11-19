import assert from "node:assert/strict";
import test from "node:test";
import { shouldCollapseTabs, tabLimitForViewport } from "./tab-navigation-layout.ts";

for (const [width, limit] of [[390, 0], [767, 0], [768, 0], [1023, 0], [1024, 6], [1440, 6]]) {
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
    assert.equal(shouldCollapseTabs({ count: 4, viewportWidth: 1440, availableWidth: 340, requiredWidth: 340.5 }), false);
    assert.equal(shouldCollapseTabs({ count: 4, viewportWidth: 1440, availableWidth: 340, requiredWidth: 342 }), true);
});

test("mobile and tablet keep every tab available through the same selector", () => {
    for (const viewportWidth of [390, 767, 768, 1023]) {
        for (const count of [1, 2, 3, 4, 6, 10]) {
            assert.equal(shouldCollapseTabs({ count, viewportWidth, availableWidth: 900, requiredWidth: 200 }), true);
        }
    }
});
