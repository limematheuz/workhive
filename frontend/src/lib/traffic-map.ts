export interface TrafficMapPoint {
    id: string;
    lat: number;
    lng: number;
    label: string;
    location: string;
}

export interface GroupedTrafficMapPoint {
    id: string;
    lat: number;
    lng: number;
    count: number;
    location: string;
}

export interface TrafficMapTransform {
    x: number;
    y: number;
    scale: number;
}

export const MAP_WIDTH = 1120;
export const MAP_HEIGHT = 520;
export const MIN_MAP_SCALE = 1;
export const MAX_MAP_SCALE = 5;

export function isValidTrafficMapPoint(point: TrafficMapPoint) {
    return (
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng) &&
        point.lat >= -90 &&
        point.lat <= 90 &&
        point.lng >= -180 &&
        point.lng <= 180
    );
}

export function groupTrafficMapPoints(points: TrafficMapPoint[]): GroupedTrafficMapPoint[] {
    const grouped = new Map<string, TrafficMapPoint[]>();
    for (const point of points) {
        if (!isValidTrafficMapPoint(point)) continue;
        const key = point.location !== "-"
            ? point.location
            : `${point.lat.toFixed(2)},${point.lng.toFixed(2)}`;
        grouped.set(key, [...(grouped.get(key) || []), point]);
    }
    return Array.from(grouped.entries()).map(([location, values]) => ({
        id: values.map((value) => value.id).join("-"),
        lat: values.reduce((sum, value) => sum + value.lat, 0) / values.length,
        lng: values.reduce((sum, value) => sum + value.lng, 0) / values.length,
        count: values.length,
        location,
    }));
}

export function clampMapValue(value: number, min: number, max: number) {
    return Math.min(max, Math.max(min, value));
}

export function clampMapTransform(transform: TrafficMapTransform): TrafficMapTransform {
    const scale = clampMapValue(transform.scale, MIN_MAP_SCALE, MAX_MAP_SCALE);
    const maxX = MAP_WIDTH * (scale - 1);
    const maxY = MAP_HEIGHT * (scale - 1);
    return {
        scale,
        x: clampMapValue(transform.x, -maxX, 0),
        y: clampMapValue(transform.y, -maxY, 0),
    };
}
