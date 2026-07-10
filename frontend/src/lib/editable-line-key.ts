export function createEditableLineKey(prefix = "line") {
    if (typeof globalThis.crypto?.randomUUID === "function") {
        return `${prefix}-${globalThis.crypto.randomUUID()}`;
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
