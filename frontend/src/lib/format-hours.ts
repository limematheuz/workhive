/**
 * Formats total seconds into a human-readable short string.
 * Examples: "2h", "3h 30m", "45m", "0m"
 */
export function formatHoursShort(totalSeconds: number): string {
    if (totalSeconds <= 0) return "0m";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h`;
    return `${minutes}m`;
}
