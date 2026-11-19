import type { LocationSpace } from "../../types/location";

type SavedSpace = LocationSpace & { id: number };
export type WorkSpaceNode = {
    space: SavedSpace;
    ancestors: SavedSpace[];
    breadcrumb: string;
    depth: number;
    floor: string;
    taskIds: number[];
    searchText: string;
};
export type WorkSpaceBranch = { key: string; label: string; spaceIds: number[] };

function searchable(text: string) {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().trim();
}

/** Keeps the saved tree order; malformed or orphaned records remain visible. */
export function buildWorkSpaceHierarchy(spaces: readonly LocationSpace[]): WorkSpaceNode[] {
    const active = spaces.filter((space): space is SavedSpace => Boolean(space.id && space.id > 0 && space.is_active !== false));
    const byId = new Map(active.map(space => [space.id, space]));
    const children = new Map<number | null, SavedSpace[]>();
    for (const space of byId.values()) {
        const parent = space.parent_id && space.parent_id !== space.id && byId.has(space.parent_id) ? space.parent_id : null;
        const siblings = children.get(parent) ?? [];
        siblings.push(space);
        children.set(parent, siblings);
    }
    for (const siblings of children.values()) siblings.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const visited = new Set<number>();
    const result: WorkSpaceNode[] = [];
    const visit = (space: SavedSpace, ancestors: SavedSpace[]) => {
        if (visited.has(space.id)) return;
        visited.add(space.id);
        const path = [...ancestors, space];
        const floor = String([...path].reverse().find(item => item.attributes?.floor != null && String(item.attributes.floor).trim() !== "")?.attributes?.floor ?? "");
        const names = path.map(item => item.name);
        const breadcrumb = (floor && !names.some(name => searchable(name) === searchable(floor)) ? [floor, ...names] : names).join(" / ");
        const taskIds = new Set<number>();
        const searchTerms = [breadcrumb, space.space_type];
        for (const task of space.tasks ?? []) {
            if (task.is_active === false) continue;
            searchTerms.push(task.title);
            if (task.id && task.id > 0) taskIds.add(task.id);
        }
        result.push({
            space, ancestors, breadcrumb, depth: ancestors.length, floor,
            taskIds: [...taskIds], searchText: searchable(searchTerms.join(" ")),
        });
        for (const child of children.get(space.id) ?? []) visit(child, path);
    };
    for (const root of children.get(null) ?? []) visit(root, []);
    for (const space of byId.values()) visit(space, []);
    return result;
}

/** A branch contains only spaces with executable tasks, never empty containers. */
export function taskSpacesInBranch(nodes: readonly WorkSpaceNode[], spaceId: number): number[] {
    return indexTaskSpaceBranches(nodes).get(spaceId) ?? [];
}

/** Build once per location; rendering each tree row then needs only a map lookup. */
export function indexTaskSpaceBranches(nodes: readonly WorkSpaceNode[]): ReadonlyMap<number, number[]> {
    const branches = new Map<number, number[]>();
    for (const node of nodes) {
        if (!node.taskIds.length) continue;
        for (const parent of [...node.ancestors, node.space]) {
            const ids = branches.get(parent.id) ?? [];
            ids.push(node.space.id);
            branches.set(parent.id, ids);
        }
    }
    return branches;
}

export function workSpaceBranches(nodes: readonly WorkSpaceNode[]): WorkSpaceBranch[] {
    const floorSpaces = new Map<string, number[]>();
    const descendantSpaces = new Map<number, number[]>();
    for (const node of nodes) {
        if (node.floor) {
            const group = floorSpaces.get(node.floor) ?? [];
            group.push(node.space.id);
            floorSpaces.set(node.floor, group);
        }
        for (const parent of node.ancestors) {
            const group = descendantSpaces.get(parent.id) ?? [];
            group.push(node.space.id);
            descendantSpaces.set(parent.id, group);
        }
    }
    const floors = [...floorSpaces].map(([floor, spaceIds]) => ({ key: `floor:${floor}`, label: floor, spaceIds }));
    const branches: WorkSpaceBranch[] = [];
    for (const node of nodes) {
        const id = node.space.id;
        const descendants = descendantSpaces.get(id);
        if (descendants) branches.push({ key: `space:${id}`, label: node.breadcrumb, spaceIds: [id, ...descendants] });
    }
    return [...floors, ...branches];
}

/** Ancestors provide context but are not automatically included in a filtered selection. */
export function filterWorkSpaceHierarchy(nodes: readonly WorkSpaceNode[], query: string, branch?: WorkSpaceBranch) {
    const needle = searchable(query);
    const allowed = branch ? new Set(branch.spaceIds) : null;
    const matches = new Set<number>();
    for (const node of nodes) if ((!allowed || allowed.has(node.space.id)) && node.searchText.includes(needle)) matches.add(node.space.id);
    const visible = new Set(matches);
    for (const node of nodes) if (matches.has(node.space.id)) for (const parent of node.ancestors) visible.add(parent.id);
    return nodes.flatMap(node => visible.has(node.space.id) ? [{ node, matches: matches.has(node.space.id) }] : []);
}

/** Preserves customised task/worker selections and rejects an oversized change in full. */
export function mergeWorkSpaceSelection<T extends { space_id: number }>(current: readonly T[], additions: readonly T[], limit = 100): T[] | null {
    const result = new Map(current.map(item => [item.space_id, item]));
    for (const item of additions) if (!result.has(item.space_id)) result.set(item.space_id, item);
    return result.size > limit ? null : [...result.values()];
}
