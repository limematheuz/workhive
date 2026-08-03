import assert from "node:assert/strict";
import test from "node:test";

import { getGuidedTourTooltipPosition } from "./guided-tour-position.ts";

const bottomStep = {
    selector: "#target",
    title: "Test",
    content: "Test",
    placement: "bottom" as const,
};

test("guided tour has deterministic initial placement before viewport measurement", () => {
    assert.deepEqual(
        getGuidedTourTooltipPosition(false, null, bottomStep, 160, { width: 0, height: 0 }),
        {
            style: {
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
            },
            arrowClass: "hidden",
        },
    );
});

test("guided tour constrains an anchored tooltip after the client viewport is known", () => {
    const position = getGuidedTourTooltipPosition(
        false,
        { top: 80, left: 900, width: 80, height: 40 },
        bottomStep,
        160,
        { width: 1024, height: 768 },
    );

    assert.deepEqual(position.style, {
        position: "absolute",
        top: "136px",
        left: "660px",
        width: "320px",
    });
    assert.match(position.arrowClass, /right-6/);
});
