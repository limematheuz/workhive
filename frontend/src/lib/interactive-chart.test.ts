import assert from "node:assert/strict";
import test from "node:test";

import {
    buildSmoothPath,
    clampNumber,
    createChartDomain,
    formatCompactNumber,
    getVisibleIndexes,
    getVisibleLabelIndexes,
    hoverEntriesHeight,
    interpolateSampleAtX,
    isInsideChartBounds,
    sampleSeriesAtX,
    type ChartPoint,
} from "./interactive-chart.ts";

test("chart domain pads flat and mixed values", () => {
    const empty = createChartDomain([]);
    assert.equal(empty.min, -0.12);
    assert.equal(empty.max, 1.12);
    assert.equal(Math.round(empty.range * 100), 124);

    const flat = createChartDomain([10, 10]);
    assert.equal(flat.min, 9.76);
    assert.equal(flat.max, 10.24);
    assert.equal(Math.round(flat.range * 100), 48);

    const mixed = createChartDomain([-100, 300]);
    assert.equal(mixed.min, -148);
    assert.equal(mixed.max, 348);
    assert.equal(mixed.range, 496);
});

test("visible indexes include one guard point and label indexes stay readable", () => {
    assert.deepEqual(getVisibleIndexes(12, 3, 8), [2, 3, 4, 5, 6, 7, 8, 9]);
    assert.deepEqual(getVisibleIndexes(3, 0, 2), [0, 1, 2]);
    assert.equal(getVisibleLabelIndexes(24, 0, 23).length <= 10, true);
});

test("smooth path uses cubic midpoint controls", () => {
    assert.equal(buildSmoothPath([]), "");
    assert.equal(buildSmoothPath([{ x: 1, y: 2 }]), "M 1 2");
    assert.equal(
        buildSmoothPath([{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 20, y: 10 }]),
        "M 0 0 C 5 0, 5 20, 10 20 C 15 20, 15 10, 20 10",
    );
});

test("chart sampling follows curved line at current x", () => {
    const points: ChartPoint[] = [
        { x: 0, y: 100, value: 0, label: "may" },
        { x: 100, y: 0, value: 100, label: "jun" },
    ];

    const sample = sampleSeriesAtX(points, 50);

    assert.ok(sample);
    assert.equal(Math.round(sample.x), 50);
    assert.equal(Math.round(sample.y), 50);
    assert.equal(Math.round(sample.value), 50);
});

test("chart sampling clamps outside series and handles interpolation", () => {
    const points: ChartPoint[] = [
        { x: 10, y: 40, value: 10, label: "left" },
        { x: 30, y: 80, value: 30, label: "right" },
    ];

    assert.deepEqual(sampleSeriesAtX(points, 0), points[0]);
    assert.deepEqual(sampleSeriesAtX(points, 40), points[1]);
    assert.equal(
        Math.round(interpolateSampleAtX([
            { x: 0, y: 0, value: 0, label: "a" },
            { x: 10, y: 20, value: 100, label: "b" },
        ], 5)?.value ?? -1),
        50,
    );
});

test("chart utility helpers clamp, format and protect bounds", () => {
    assert.equal(clampNumber(20, 0, 10), 10);
    assert.equal(clampNumber(-1, 0, 10), 0);
    assert.equal(formatCompactNumber(1_500_000), "1.5M");
    assert.equal(formatCompactNumber(-1_200), "-1k");
    assert.equal(formatCompactNumber(42), "42");
    assert.equal(hoverEntriesHeight(0, 16), 24);
    assert.equal(hoverEntriesHeight(3, 16), 56);
    assert.equal(isInsideChartBounds({ x: 5, y: 5 }, { left: 0, right: 10, top: 0, bottom: 10 }), true);
    assert.equal(isInsideChartBounds({ x: -1, y: 5 }, { left: 0, right: 10, top: 0, bottom: 10 }), false);
});
