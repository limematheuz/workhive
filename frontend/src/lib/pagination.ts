export async function collectPaginated<T>(
    fetchPage: (skip: number, limit: number) => Promise<T[]>,
    pageSize = 500,
    maxPages = 100,
): Promise<T[]> {
    const items: T[] = [];
    for (let page = 0; page < maxPages; page += 1) {
        const chunk = await fetchPage(page * pageSize, pageSize);
        items.push(...chunk);
        if (chunk.length < pageSize) return items;
    }
    throw new Error("Pagination safety limit reached");
}
