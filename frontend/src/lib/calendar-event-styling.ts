import type { TaskStatus } from "../types/task.ts";

/** Solid accents used in badges and detail chips. */
export const CALENDAR_STATUS_COLORS: Record<TaskStatus, string> = {
    requested: "#e11d48",
    pending: "#d97706",
    accepted: "var(--brand-blue)",
    rejected: "#e11d48",
    progress: "var(--brand-blue-hover)",
    review: "#7c3aed",
    completed: "var(--brand-blue)",
};

/**
 * Soft card fills inspired by modern schedule UIs, without matching
 * the reference pastel green / lavender / peach palette.
 */
export const CALENDAR_STATUS_SOFT_COLORS: Record<TaskStatus, { background: string; accent: string; text: string }> = {
    requested: { background: "#fff1f2", accent: "#e11d48", text: "#9f1239" },
    pending: { background: "#fff7ed", accent: "#d97706", text: "#9a3412" },
    accepted: { background: "#eff6ff", accent: "var(--brand-blue)", text: "#1e3a8a" },
    rejected: { background: "#fff1f2", accent: "#e11d48", text: "#9f1239" },
    progress: { background: "#eef4ff", accent: "var(--brand-blue-hover)", text: "#1e3a8a" },
    review: { background: "#f5f3ff", accent: "#7c3aed", text: "#5b21b6" },
    completed: { background: "#eff6ff", accent: "var(--brand-blue)", text: "#1e3a8a" },
};

export function isCalendarEventPast(end: Date | null | undefined, now: Date = new Date()): boolean {
    if (!end) return false;
    return end.getTime() < now.getTime();
}
