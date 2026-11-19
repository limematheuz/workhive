type SnapshotLine = { description: string; quantity: number | string; unit_price: number | string; subtotal: number | string; tax_rate?: number | string | null; total?: number | string | null };

/** Snapshot rows have no IDs. Duplicate occurrences are local to the same content. */
export function snapshotLineRows<T extends SnapshotLine>(lines: readonly T[]): { key: string; line: T }[] {
    const duplicates = new Map<string, number>();
    return lines.map(line => {
        const identity = JSON.stringify([line.description, line.quantity, line.unit_price, line.subtotal, line.tax_rate, line.total]);
        const occurrence = (duplicates.get(identity) ?? 0) + 1;
        duplicates.set(identity, occurrence);
        return { key: identity + ":" + occurrence, line };
    });
}
