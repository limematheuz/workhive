export async function optionalSource<T>(allowed: boolean, read: () => Promise<T>, fallback: T) {
    if (!allowed) return { value: fallback, available: false, failed: false };
    try { return { value: await read(), available: true, failed: false }; }
    catch { return { value: fallback, available: false, failed: true }; }
}
