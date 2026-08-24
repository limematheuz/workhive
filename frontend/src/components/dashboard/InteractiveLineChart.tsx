"use client";

import {
    useCallback,
    useId,
    useMemo,
    useState,
    type PointerEvent,
} from "react";
import {
    buildSmoothPath,
    clampNumber,
    createChartDomain,
    formatCompactNumber,
    getVisibleIndexes,
    getVisibleLabelIndexes,
    hoverEntriesHeight,
    isInsideChartBounds,
    sampleSeriesAtX,
    type ChartPoint,
} from "@/lib/interactive-chart";

export interface InteractiveLineChartSeries {
    id: string;
    label: string;
    color: string;
    values: number[];
    valueFormatter?: (value: number) => string;
    strokeOpacity?: number;
}

interface InteractiveLineChartProps {
    labels: string[];
    series: InteractiveLineChartSeries[];
    emptyLabel: string;
    yFormatter?: (value: number) => string;
    className?: string;
    svgClassName?: string;
    includeZero?: boolean;
}

interface DrawableSeries extends InteractiveLineChartSeries {
    points: ChartPoint[];
    path: string;
    areaPath: string;
}

interface HoverState {
    x: number;
    y: number;
    label: string;
    entries: Array<{
        id: string;
        label: string;
        color: string;
        value: number;
        y: number;
        valueFormatter?: (value: number) => string;
    }>;
}

const VIEWBOX_WIDTH = 1120;
const VIEWBOX_HEIGHT = 520;
const CHART_PADDING = { top: 34, right: 36, bottom: 62, left: 70 };
const TOOLTIP_WIDTH = 190;
const TOOLTIP_ROW_HEIGHT = 16;
const TOOLTIP_HEADER_HEIGHT = 24;
const LINE_HIT_RADIUS_PX = 7;

export function InteractiveLineChart({
    labels,
    series,
    emptyLabel,
    yFormatter = formatCompactNumber,
    className = "",
    svgClassName = "h-[27rem] sm:h-[32rem]",
    includeZero = true,
}: InteractiveLineChartProps) {
    const [hover, setHover] = useState<HoverState | null>(null);
    const instanceId = useId().replace(/:/g, "");
    const clipId = `${instanceId}-interactive-chart-clip`;
    const viewportStart = 0;
    const viewportEnd = Math.max(0, labels.length - 1);
    const bounds = useMemo(() => ({
        left: CHART_PADDING.left,
        right: VIEWBOX_WIDTH - CHART_PADDING.right,
        top: CHART_PADDING.top,
        bottom: VIEWBOX_HEIGHT - CHART_PADDING.bottom,
    }), []);
    const chartWidth = bounds.right - bounds.left;
    const chartHeight = bounds.bottom - bounds.top;

    const visibleIndexes = useMemo(
        () => getVisibleIndexes(labels.length, viewportStart, viewportEnd),
        [labels.length, viewportEnd, viewportStart],
    );
    const visibleValues = useMemo(() => {
        const values = series.flatMap((item) => visibleIndexes.map((index) => item.values[index] ?? 0));
        return includeZero ? [0, ...values] : values;
    }, [includeZero, series, visibleIndexes]);
    const domain = useMemo(() => createChartDomain(visibleValues), [visibleValues]);
    const visibleRange = Math.max(1, viewportEnd - viewportStart);
    const toX = useCallback((index: number) => (
        bounds.left + ((index - viewportStart) / visibleRange) * chartWidth
    ), [bounds.left, chartWidth, viewportStart, visibleRange]);
    const toY = useCallback((value: number) => (
        bounds.top + chartHeight - ((value - domain.min) / domain.range) * chartHeight
    ), [bounds.top, chartHeight, domain.min, domain.range]);

    const drawableSeries = useMemo<DrawableSeries[]>(() => (
        series.map((item) => {
            const points = labels.map((label, index) => ({
                x: toX(index),
                y: toY(item.values[index] ?? 0),
                value: item.values[index] ?? 0,
                label,
            }));
            const path = buildSmoothPath(points);
            const lastIndex = Math.max(0, labels.length - 1);
            const areaPath = path
                ? `${path} L ${toX(lastIndex)} ${bounds.bottom} L ${bounds.left} ${bounds.bottom} Z`
                : "";
            return { ...item, points, path, areaPath };
        })
    ), [bounds.bottom, bounds.left, labels, series, toX, toY]);

    const yTicks = useMemo(() => (
        Array.from({ length: 4 }, (_, index) => domain.min + (domain.range / 3) * index).reverse()
    ), [domain.min, domain.range]);
    const visibleLabelIndexes = useMemo(
        () => getVisibleLabelIndexes(labels.length, viewportStart, viewportEnd),
        [labels.length, viewportEnd, viewportStart],
    );

    const handlePointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
        const mouse = getSvgPointer(event);
        if (!isInsideChartBounds(mouse, bounds)) {
            setHover(null);
            return;
        }
        const hitRadius = getSvgVerticalDistance(event.currentTarget, event.clientX, event.clientY, LINE_HIT_RADIUS_PX);

        const candidates = drawableSeries
            .flatMap((item) => {
                const point = sampleSeriesAtX(item.points, mouse.x);
                if (!point) return [];
                return [{
                    id: item.id,
                    label: item.label,
                    color: item.color,
                    value: point.value,
                    y: point.y,
                    pointLabel: point.label,
                    distance: Math.abs(point.y - mouse.y),
                    valueFormatter: item.valueFormatter,
                }];
            })
            .sort((left, right) => {
                return left.distance - right.distance;
            });
        const closest = candidates[0];

        if (!closest || closest.distance > hitRadius) {
            setHover(null);
            return;
        }

        setHover({
            x: mouse.x,
            y: closest.y,
            label: closest.pointLabel,
            entries: [{
                id: closest.id,
                label: closest.label,
                color: closest.color,
                value: closest.value,
                y: closest.y,
                valueFormatter: closest.valueFormatter,
            }],
        });
    }, [bounds, drawableSeries]);

    if (labels.length === 0 || series.length === 0) {
        return (
            <div className={`relative mt-4 rounded-[18px] border border-dashed border-[var(--border-soft)] bg-[var(--bg-secondary)] p-5 text-center text-sm text-[var(--text-muted)] ${className}`}>
                {emptyLabel}
            </div>
        );
    }

    const tooltipHeight = TOOLTIP_HEADER_HEIGHT + hoverEntriesHeight(hover?.entries.length ?? 0, TOOLTIP_ROW_HEIGHT);
    const tooltipLeft = hover ? clampNumber(hover.x + 14, bounds.left, bounds.right - TOOLTIP_WIDTH) : 0;
    const tooltipTop = hover ? clampNumber(hover.y - tooltipHeight - 12, bounds.top, bounds.bottom - tooltipHeight) : 0;

    return (
        <div className={`relative z-10 mt-4 overflow-hidden rounded-[18px] border border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--bg-secondary)_98%,var(--text-main)_2%)] p-3 ${className}`}>
            <svg
                viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
                className={`w-full cursor-default select-none overflow-visible ${svgClassName}`}
                onPointerMove={handlePointerMove}
                onPointerLeave={() => setHover(null)}
            >
                <defs>
                    <clipPath id={clipId}>
                        <rect
                            x={bounds.left}
                            y={bounds.top}
                            width={chartWidth}
                            height={chartHeight}
                        />
                    </clipPath>
                    {drawableSeries.map((item, index) => (
                        <linearGradient key={item.id} id={`${instanceId}-chart-area-${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={item.color} stopOpacity="0.1" />
                            <stop offset="100%" stopColor={item.color} stopOpacity="0" />
                        </linearGradient>
                    ))}
                </defs>

                {yTicks.map((tick) => {
                    const y = toY(tick);
                    return (
                        <g key={tick}>
                            <line
                                x1={bounds.left}
                                x2={bounds.right}
                                y1={y}
                                y2={y}
                                stroke="var(--border-color)"
                                strokeDasharray="5 8"
                                opacity="0.42"
                            />
                            <text x={14} y={y + 4} fill="var(--text-muted)" fontSize="11" fontWeight="700">
                                {yFormatter(tick)}
                            </text>
                        </g>
                    );
                })}

                <g clipPath={`url(#${clipId})`}>
                    {drawableSeries.map((item, index) => (
                        <g key={item.id}>
                            <path d={item.areaPath} fill={`url(#${instanceId}-chart-area-${index})`} />
                            <path
                                d={item.path}
                                fill="none"
                                stroke={item.color}
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                opacity={item.strokeOpacity ?? 0.98}
                            />
                        </g>
                    ))}
                </g>

                {hover && (
                    <g pointerEvents="none">
                        <line
                            x1={hover.x}
                            x2={hover.x}
                            y1={bounds.top}
                            y2={bounds.bottom}
                            stroke="var(--border-color)"
                            strokeDasharray="4 6"
                            opacity="0.52"
                        />
                        {hover.entries.map((entry) => (
                            <circle
                                key={entry.id}
                                cx={hover.x}
                                cy={entry.y}
                                r="4.5"
                                fill="var(--bg-card-solid)"
                                stroke={entry.color}
                                strokeWidth="2.2"
                            />
                        ))}
                        <rect
                            x={tooltipLeft}
                            y={tooltipTop}
                            width={TOOLTIP_WIDTH}
                            height={tooltipHeight}
                            rx="13"
                            fill="var(--bg-card-solid)"
                            stroke="var(--border-soft)"
                            opacity="0.98"
                        />
                        <text x={tooltipLeft + 14} y={tooltipTop + 18} fill="var(--text-main)" fontSize="11" fontWeight="900">
                            {hover.label}
                        </text>
                        {hover.entries.map((entry, index) => {
                            const y = tooltipTop + TOOLTIP_HEADER_HEIGHT + index * TOOLTIP_ROW_HEIGHT + 11;
                            return (
                                <g key={entry.id}>
                                    <circle cx={tooltipLeft + 14} cy={y - 4} r="3.5" fill={entry.color} />
                                    <text x={tooltipLeft + 24} y={y} fill="var(--text-muted)" fontSize="10" fontWeight="800">
                                        {entry.label}
                                    </text>
                                    <text x={tooltipLeft + TOOLTIP_WIDTH - 12} y={y} textAnchor="end" fill="var(--text-main)" fontSize="10" fontWeight="900">
                                        {entry.valueFormatter ? entry.valueFormatter(entry.value) : Math.round(entry.value)}
                                    </text>
                                </g>
                            );
                        })}
                    </g>
                )}

                {visibleLabelIndexes.map((index) => (
                    <text
                        key={labels[index]}
                        x={toX(index)}
                        y={VIEWBOX_HEIGHT - 14}
                        textAnchor="middle"
                        fill="var(--text-muted)"
                        fontSize="11"
                        fontWeight="800"
                    >
                        {labels[index]}
                    </text>
                ))}
            </svg>
            <div className="mt-1 flex flex-wrap gap-4 border-t border-[var(--border-soft)] pt-3 text-[11px] font-black text-[var(--text-muted)]">
                {series.map((item) => (
                    <span key={item.id} className="inline-flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                        {item.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

function getSvgPointer(event: PointerEvent<SVGSVGElement>) {
    return clientPointToSvgPoint(event.currentTarget, event.clientX, event.clientY);
}

function getSvgVerticalDistance(
    svg: SVGSVGElement,
    clientX: number,
    clientY: number,
    screenPixels: number,
) {
    const start = clientPointToSvgPoint(svg, clientX, clientY);
    const end = clientPointToSvgPoint(svg, clientX, clientY + screenPixels);
    return Math.abs(end.y - start.y);
}

function clientPointToSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };

    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const svgPoint = point.matrixTransform(matrix.inverse());
    return { x: svgPoint.x, y: svgPoint.y };
}
