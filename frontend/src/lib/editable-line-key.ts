export function createClientId() {
    if (typeof globalThis.crypto?.randomUUID === "function") {
        return globalThis.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createEditableLineKey(prefix = "line") {
    return `${prefix}-${createClientId()}`;
}
