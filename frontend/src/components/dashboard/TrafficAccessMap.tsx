"use client";

import { useCallback, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import {
    MAP_HEIGHT,
    MAP_WIDTH,
    MAX_MAP_SCALE,
    MIN_MAP_SCALE,
    clampMapTransform,
    groupTrafficMapPoints,
    type TrafficMapPoint,
} from "@/lib/traffic-map";

interface TrafficAccessMapProps {
    points: TrafficMapPoint[];
    emptyDescription: string;
    activeLocationsLabel: string;
}

interface RegionPoint {
    id: string;
    lat: number;
    lng: number;
    count: number;
    location: string;
    x: number;
    y: number;
}

const countries = feature(
    worldAtlas as never,
    (worldAtlas as unknown as { objects: { countries: never } }).objects.countries
) as unknown as GeoJSON.FeatureCollection;

const visibleCountries = {
    ...countries,
    features: countries.features.filter((country) => country.properties?.name !== "Antarctica"),
} as GeoJSON.FeatureCollection;

export function TrafficAccessMap({ points, emptyDescription, activeLocationsLabel }: TrafficAccessMapProps) {
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
        rectWidth: number;
        rectHeight: number;
    } | null>(null);

    const { countryPaths, graticulePath, regions } = useMemo(() => {
        const projection = geoNaturalEarth1()
            .fitExtent(
                [
                    [0, 0],
                    [MAP_WIDTH, MAP_HEIGHT],
                ],
                visibleCountries
            );
        const path = geoPath(projection);
        const projectedRegions: RegionPoint[] = groupTrafficMapPoints(points).flatMap((region) => {
            const projected = projection([region.lng, region.lat]);
            if (!projected) return [];
            return [{
                ...region,
                x: projected[0],
                y: projected[1],
            }];
        });

        return {
            countryPaths: visibleCountries.features.flatMap((country) => {
                const countryPath = path(country);
                return countryPath ? [countryPath] : [];
            }),
            graticulePath: path(geoGraticule10()) || "",
            regions: projectedRegions.sort((left, right) => right.count - left.count),
        };
    }, [points]);

    const accessCount = regions.reduce((sum, region) => sum + region.count, 0);

    const handlePointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
        if (event.button !== 0) return;
        const rect = event.currentTarget.getBoundingClientRect();
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: transform.x,
            originY: transform.y,
            rectWidth: rect.width,
            rectHeight: rect.height,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
    }, [transform.x, transform.y]);

    const handlePointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = ((event.clientX - drag.startX) / drag.rectWidth) * MAP_WIDTH;
        const dy = ((event.clientY - drag.startY) / drag.rectHeight) * MAP_HEIGHT;
        setTransform((current) => clampMapTransform({
            scale: current.scale,
            x: drag.originX + dx,
            y: drag.originY + dy,
        }));
    }, []);

    const stopDragging = useCallback((event: PointerEvent<SVGSVGElement>) => {
        if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null;
            setDragging(false);
        }
    }, []);

    const handleWheel = useCallback((event: WheelEvent<SVGSVGElement>) => {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const svgX = ((event.clientX - rect.left) / rect.width) * MAP_WIDTH;
        const svgY = ((event.clientY - rect.top) / rect.height) * MAP_HEIGHT;
        const factor = event.deltaY < 0 ? 1.16 : 0.86;

        setTransform((current) => {
            const nextScale = Math.min(MAX_MAP_SCALE, Math.max(MIN_MAP_SCALE, current.scale * factor));
            const worldX = (svgX - current.x) / current.scale;
            const worldY = (svgY - current.y) / current.scale;
            return clampMapTransform({
                scale: nextScale,
                x: svgX - worldX * nextScale,
                y: svgY - worldY * nextScale,
            });
        });
    }, []);

    const zoomBy = useCallback((factor: number) => {
        setTransform((current) => {
            const nextScale = Math.min(MAX_MAP_SCALE, Math.max(MIN_MAP_SCALE, current.scale * factor));
            return clampMapTransform({
                scale: nextScale,
                x: (MAP_WIDTH / 2) - ((MAP_WIDTH / 2 - current.x) / current.scale) * nextScale,
                y: (MAP_HEIGHT / 2) - ((MAP_HEIGHT / 2 - current.y) / current.scale) * nextScale,
            });
        });
    }, []);

    return (
        <div className="mt-1 overflow-hidden">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_16rem]">
                <div className="relative overflow-hidden rounded-[18px] border border-[var(--border-soft)] bg-[var(--bg-card-solid)]">
                    <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)]/95 p-1 shadow-sm backdrop-blur">
                        <button
                            type="button"
                            onClick={() => zoomBy(1.22)}
                            className="h-8 w-8 rounded-lg bg-accent text-sm font-semibold text-white transition hover:bg-[var(--brand-blue-hover)]"
                            aria-label="Zoom in"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            onClick={() => zoomBy(0.82)}
                            className="h-8 w-8 rounded-lg bg-[color-mix(in_srgb,var(--text-main)_10%,var(--bg-card-solid)_90%)] text-sm font-semibold text-[var(--text-main)] transition hover:bg-[color-mix(in_srgb,var(--accent-color)_14%,var(--bg-card-solid)_86%)]"
                            aria-label="Zoom out"
                        >
                            -
                        </button>
                    </div>
                    <svg
                        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                        role="img"
                        aria-label="Global traffic reach map"
                        preserveAspectRatio="xMidYMid meet"
                        className={`block h-auto w-full touch-none select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={stopDragging}
                        onPointerCancel={stopDragging}
                        onWheel={handleWheel}
                    >
                        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="var(--bg-card-solid)" />
                        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
                            <path
                                d={graticulePath}
                                fill="none"
                                stroke="color-mix(in srgb, var(--text-muted) 46%, transparent)"
                                strokeWidth="0.85"
                                opacity="0.52"
                            />
                            {countryPaths.map((countryPath) => (
                                <path
                                    key={countryPath}
                                    d={countryPath}
                                    fill="color-mix(in srgb, var(--text-muted) 76%, var(--bg-card-solid))"
                                    opacity="0.9"
                                    stroke="color-mix(in srgb, var(--text-muted) 42%, var(--bg-card-solid))"
                                    strokeWidth="0.45"
                                />
                            ))}

                            {regions.map((region) => {
                                const value = region.count.toLocaleString();
                                const width = Math.max(56, value.length * 10 + 32);
                                const labelX = Math.min(MAP_WIDTH - width - 14, Math.max(14, region.x - width / 2));
                                const labelY = Math.max(14, region.y - 48);
                                return (
                                    <g key={region.id}>
                                        <circle cx={region.x} cy={region.y} r="14" fill="var(--accent-color)" opacity="0.16" />
                                        <circle cx={region.x} cy={region.y} r="6" fill="var(--accent-color)" />
                                        <rect
                                            x={labelX}
                                            y={labelY}
                                            width={width}
                                            height="30"
                                            rx="8"
                                            fill="var(--bg-card-solid)"
                                            stroke="var(--border-color)"
                                        />
                                        <circle cx={labelX + 16} cy={labelY + 15} r="5" fill="var(--btn-cancel-text)" />
                                        <text
                                            x={labelX + 28}
                                            y={labelY + 20}
                                            fill="var(--text-main)"
                                            fontSize="14"
                                            fontWeight="800"
                                        >
                                            {value}
                                        </text>
                                        <path
                                            d={`M ${region.x - 8} ${labelY + 29} L ${region.x} ${labelY + 39} L ${region.x + 8} ${labelY + 29}`}
                                            fill="var(--bg-card-solid)"
                                            stroke="var(--border-color)"
                                        />
                                    </g>
                                );
                            })}
                        </g>
                    </svg>

                </div>

                <aside className="billing-block rounded-[18px] border border-[var(--border-soft)] p-3.5 text-sm">
                    <p className="font-mono text-2xl font-semibold text-[var(--text-main)]">
                        {regions.length.toLocaleString()}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        {activeLocationsLabel}
                    </p>

                    <div className="mt-4 grid gap-2.5">
                        {regions.length > 0 ? (
                            regions.slice(0, 6).map((region) => {
                                const percent = accessCount > 0 ? Math.max(8, Math.round((region.count / accessCount) * 100)) : 0;
                                return (
                                    <div key={region.id}>
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="min-w-0 truncate text-sm font-semibold text-[var(--text-main)]">
                                                {region.location}
                                            </p>
                                            <span className="font-mono text-xs font-semibold text-[var(--text-muted)]">
                                                {region.count}
                                            </span>
                                        </div>
                                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--border-soft)]">
                                            <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-xs leading-5 text-[var(--text-muted)]">{emptyDescription}</p>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
}
