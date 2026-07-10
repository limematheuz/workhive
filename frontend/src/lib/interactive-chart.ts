export interface ChartPoint {
    x: number;
    y: number;
    value: number;
    label: string;
}

export interface ChartBounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export function createChartDomain(values: number[]) {
    const safeValues = values.length ? values : [0, 1];
    const rawMin = Math.min(...safeValues);
    const rawMax = Math.max(...safeValues);
    const rawRange = rawMax - rawMin || Math.max(1, Math.abs(rawMax) * 0.2);
    const padding = rawRange * 0.12;
    const min = rawMin - padding;
    const max = rawMax + padding;
    return { min, max, range: max - min || 1 };
}

export function getVisibleIndexes(count: number, start: number, end: number) {
    const first = Math.max(0, Math.floor(start) - 1);
    const last = Math.min(count - 1, Math.ceil(end) + 1);
    return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
}

export function getVisibleLabelIndexes(count: number, start: number, end: number) {
    const indexes = getVisibleIndexes(count, start, end);
    const step = Math.max(1, Math.ceil(indexes.length / 9));
    return indexes.filter((_, index) => index % step === 0 || index === indexes.length - 1);
}

export function isInsideChartBounds(point: { x: number; y: number }, bounds: ChartBounds) {
    return (
        point.x >= bounds.left &&
        point.x <= bounds.right &&
        point.y >= bounds.top &&
        point.y <= bounds.bottom
    );
}

export function sampleSeriesAtX(points: ChartPoint[], targetX: number) {
    if (points.length === 0) return null;
    if (points.length === 1) return points[0];

    const segmentIndex = points.findIndex((point, index) => (
        index > 0 &&
        targetX >= Math.min(points[index - 1].x, point.x) &&
        targetX <= Math.max(points[index - 1].x, point.x)
    ));
    if (segmentIndex === -1) return targetX < points[0].x ? points[0] : points[points.length - 1];

    const previous = points[segmentIndex - 1];
    const next = points[segmentIndex];
    const controlX = (previous.x + next.x) / 2;
    const samples = Array.from({ length: 73 }, (_, index) => {
        const t = index / 72;
        const point = cubicBezierPoint(
            { x: previous.x, y: previous.y },
            { x: controlX, y: previous.y },
            { x: controlX, y: next.y },
            { x: next.x, y: next.y },
            t,
        );
        return {
            ...point,
            value: previous.value + (next.value - previous.value) * t,
            label: t < 0.5 ? previous.label : next.label,
        };
    });
    return interpolateSampleAtX(samples, targetX);
}

export function interpolateSampleAtX(
    samples: Array<{ x: number; y: number; value: number; label: string }>,
    targetX: number,
) {
    const sorted = [...samples].sort((left, right) => left.x - right.x);
    const leftPoint = [...sorted].reverse().find((point) => point.x <= targetX);
    const rightPoint = sorted.find((point) => point.x >= targetX);

    if (!leftPoint && !rightPoint) return null;
    if (!leftPoint) return rightPoint;
    if (!rightPoint) return leftPoint;
    if (Math.abs(rightPoint.x - leftPoint.x) < 0.001) return { ...leftPoint, x: targetX };

    const ratio = (targetX - leftPoint.x) / (rightPoint.x - leftPoint.x);
    return {
        x: targetX,
        y: leftPoint.y + (rightPoint.y - leftPoint.y) * ratio,
        value: leftPoint.value + (rightPoint.value - leftPoint.value) * ratio,
        label: ratio < 0.5 ? leftPoint.label : rightPoint.label,
    };
}

export function cubicBezierPoint(
    start: { x: number; y: number },
    controlA: { x: number; y: number },
    controlB: { x: number; y: number },
    end: { x: number; y: number },
    t: number,
) {
    const mt = 1 - t;
    return {
        x: mt ** 3 * start.x + 3 * mt ** 2 * t * controlA.x + 3 * mt * t ** 2 * controlB.x + t ** 3 * end.x,
        y: mt ** 3 * start.y + 3 * mt ** 2 * t * controlA.y + 3 * mt * t ** 2 * controlB.y + t ** 3 * end.y,
    };
}

export function buildSmoothPath(points: Array<{ x: number; y: number }>) {
    if (points.length === 0) return "";
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
    return points.reduce((path, point, index) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        const previous = points[index - 1];
        const controlX = (previous.x + point.x) / 2;
        return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
    }, "");
}

export function hoverEntriesHeight(count: number, rowHeight: number) {
    return Math.max(1, count) * rowHeight + 8;
}

export function clampNumber(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function formatCompactNumber(value: number) {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}k`;
    return `${sign}${Math.round(abs)}`;
}
