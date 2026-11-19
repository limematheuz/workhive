import type { Location } from "../types/location.ts";

export type TaskLocationReference = { location_id: number };
export type TaskLocationSnapshot = { scope: string; details: Location[] };

export function taskWorkspaceKey(user: { id: number; company_id?: number | null; role?: { name?: string } } | null): string {
    return user ? `${user.id}:${user.company_id ?? "none"}:${user.role?.name ?? "none"}` : "anonymous";
}

export function taskLocationIds(tasks: readonly TaskLocationReference[]): number[] {
    return [...new Set(tasks.map(task => task.location_id))]
        .filter(id => Number.isSafeInteger(id) && id > 0)
        .sort((first, second) => first - second);
}

/** Hydrate authorized task references without changing the location creation catalog. */
export async function readTaskLocationDetails(
    ids: readonly number[], master: readonly Location[], read: (id: number) => Promise<Location>,
): Promise<Location[]> {
    const known = new Set(master.map(location => location.id));
    const missingReads: Promise<Location | null>[] = [];
    for (const id of ids) {
        if (known.has(id)) continue;
        missingReads.push((async (): Promise<Location | null> => {
            try {
                const location = await read(id);
                return location.id === id ? location : null;
            } catch {
                return null;
            }
        })());
    }
    const details = await Promise.all(missingReads);
    return details.filter((location): location is Location => location !== null);
}

export async function readTaskLocationSnapshot(
    scope: string, ids: readonly number[], master: readonly Location[], read: (id: number) => Promise<Location>,
): Promise<TaskLocationSnapshot> {
    return { scope, details: await readTaskLocationDetails(ids, master, read) };
}

export function taskLocationsForScope(
    snapshot: TaskLocationSnapshot | null, scope: string | null,
    master: readonly Location[], allowedIds: readonly number[],
): Location[] {
    if (scope === null) return [];
    const allowed = new Set(allowedIds);
    const details = snapshot?.scope === scope
        ? snapshot.details.filter(location => allowed.has(location.id)) : [];
    return [...new Map([...master, ...details].map(location => [location.id, location])).values()];
}
