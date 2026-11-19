import type { LocationProfile, LocationSpace, LocationSpaceTask, LocationSpaceTemplate } from "../../types/location.ts";

export type LocationFloor = {
    id: string;
    name: string;
    level: number;
    surface: number;
    counts: Record<string, number>;
};

type Profile = Omit<LocationProfile, "location_id">;
const finiteCount = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
const titleKey = (title: string) => title.trim().replace(/[.\s]+$/u, "").toLocaleLowerCase();

export function uniqueLocationTasks(tasks: LocationSpaceTask[]): LocationSpaceTask[] {
    const seen = new Set<string>();
    return tasks.filter((task) => {
        const key = titleKey(task.title);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function readLocationFloors(profile: Profile): LocationFloor[] {
    try {
        const saved: unknown = JSON.parse(String(profile.attributes.floor_plan || "null"));
        if (Array.isArray(saved) && saved.length && saved.length <= 100) {
            const floors = saved.filter((floor) => floor && typeof floor.id === "string" && typeof floor.name === "string" && typeof floor.counts === "object" && floor.counts !== null);
            if (floors.length === saved.length) return floors.map((floor) => ({
                id: floor.id, name: floor.name, level: finiteCount(floor.level), surface: finiteCount(floor.surface),
                counts: Object.fromEntries(Object.entries(floor.counts).map(([key, count]) => [key, finiteCount(count)])),
            }));
        }
    } catch { /* Older profiles have no floor layout. Their counts remain available. */ }
    const count = Math.min(Math.max(1, finiteCount(profile.attributes.floor_count)), 100);
    return Array.from({ length: count }, (_, index) => ({
        id: `floor-${index}`, name: index === 0 ? "Planta baja" : `Planta ${index}`, level: index,
        surface: index === 0 ? finiteCount(profile.attributes.surface_m2) : 0,
        counts: index === 0 ? Object.fromEntries(Object.entries(profile.attributes)
            .flatMap(([key, value]) => key.endsWith("_count") && key !== "floor_count" ? [[key, finiteCount(value)]] : [])) : {},
    }));
}

export function withLocationFloors(profile: Profile, floors: LocationFloor[]): Profile {
    const counts: Record<string, number> = {};
    const previousKeys = Object.keys(profile.attributes).filter((key) => key.endsWith("_count") && key !== "floor_count");
    previousKeys.forEach((key) => { counts[key] = 0; });
    floors.forEach((floor) => Object.entries(floor.counts).forEach(([key, count]) => { counts[key] = (counts[key] || 0) + finiteCount(count); }));
    return { ...profile, attributes: { ...profile.attributes, ...counts, floor_count: floors.length, surface_m2: floors.reduce((sum, floor) => sum + finiteCount(floor.surface), 0), floor_plan: JSON.stringify(floors) } };
}

export function createSpaceFromTemplate(template: LocationSpaceTemplate, existing: LocationSpace[], floor?: string): LocationSpace {
    const names = new Set(existing.map((space) => space.name.trim().toLocaleLowerCase()));
    let index = 1;
    while (names.has(`${template.name} ${index}`.toLocaleLowerCase())) index++;
    return {
        name: `${template.name} ${index}`, space_type: template.space_type,
        attributes: { catalog_template: template.id, ...(floor ? { floor } : {}) },
        tasks: template.tasks.map((title) => ({ title, category: "cleaning" })),
    };
}

export function locationTaskEstimate(spaces: LocationSpace[]) {
    const estimate = { tasks: 0, minutes: 0, unestimated: 0 };
    for (const space of spaces) {
        for (const task of space.tasks || []) {
            if (task.is_active === false) continue;
            estimate.tasks++;
            if (task.estimated_minutes) estimate.minutes += task.estimated_minutes;
            else estimate.unestimated++;
        }
    }
    return estimate;
}
