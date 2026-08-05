export type ChecklistStepSource = { text: string };

/**
 * The API stores service steps as a markdown-compatible checklist. This module
 * keeps that representation at the boundary so users never have to edit it.
 */
export function parseChecklistStepTexts(description: string | null | undefined): string[] {
    const source = description?.trim() || "";
    if (!source) return [];

    const checklistItems = source
        .split("\n")
        .flatMap((line) => {
            const match = line.match(/^\s*[-*]?\s*\[\s*[xX\s]?\s*\]\s*(.+)$/);
            return match?.[1].trim() ? [match[1].trim()] : [];
        });

    return checklistItems.length ? checklistItems : [source];
}

export function serializeChecklistSteps(steps: ChecklistStepSource[]): string {
    return steps
        .flatMap((step) => {
            const text = step.text.trim();
            return text ? [`- [ ] ${text}`] : [];
        })
        .join("\n");
}
