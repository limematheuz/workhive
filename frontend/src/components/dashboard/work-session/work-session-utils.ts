export function cleanWorkSessionLocalStorage(userId: number, sessionId: number) {
    localStorage.removeItem(`workhive_session_paused_${userId}_${sessionId}`)
    localStorage.removeItem(`workhive_session_total_paused_${userId}_${sessionId}`)
    localStorage.removeItem(`workhive_session_last_paused_at_${userId}_${sessionId}`)
    localStorage.removeItem(`workhive_monitored_tasks_${userId}_${sessionId}`)
}

export function formatElapsedTimeFromStart(
    startTime: string,
    pausedAt?: string | null,
    pausedSeconds: number = 0,
): string {
    const startMs = new Date(startTime).getTime()
    const now = new Date().getTime()
    const activePauseSeconds = pausedAt
        ? Math.max(0, Math.floor((now - new Date(pausedAt).getTime()) / 1000))
        : 0
    const difference = now - startMs - ((pausedSeconds + activePauseSeconds) * 1000)

    if (difference <= 0) {
        return "00:00:00"
    }

    const totalSeconds = Math.floor(difference / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    const formattedHours = hours.toString().padStart(2, "0")
    const formattedMinutes = minutes.toString().padStart(2, "0")
    const formattedSeconds = seconds.toString().padStart(2, "0")

    return `${formattedHours}:${formattedMinutes}:${formattedSeconds}`
}
