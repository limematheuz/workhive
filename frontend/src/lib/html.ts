const HTML_ENTITIES: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

export function escapeHtml(value: unknown): string {
    return String(value ?? "").replace(/[&<>"']/g, (character) => HTML_ENTITIES[character]);
}

export function escapeHtmlWithLineBreaks(value: unknown): string {
    return escapeHtml(value).replace(/\r?\n/g, "<br/>");
}
