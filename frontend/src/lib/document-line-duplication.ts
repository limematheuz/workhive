export function duplicateDocumentLine<T extends { id: string }>(
    rows: T[],
    id: string,
    createDuplicate: (source: T) => T,
): T[] {
    const sourceIndex = rows.findIndex((row) => row.id === id);
    if (sourceIndex < 0) return rows;

    return [
        ...rows.slice(0, sourceIndex + 1),
        createDuplicate(rows[sourceIndex]),
        ...rows.slice(sourceIndex + 1),
    ];
}
