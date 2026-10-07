export const POLL_INTERVALS = {
    // Used only while the SSE broker reconnects. Normal updates arrive as
    // invalidations immediately and need no full-list polling.
    calendar: 5_000,
    dashboard: 5_000,
    liveWork: 3_000,
    locations: 5_000,
    notifications: 5_000,
    privacy: 5_000,
    reservations: 5_000,
    sidebar: 5_000,
    sidebarTaskCount: 5_000,
    tasks: 5_000,
    collaborations: 5_000,
    clients: 10_000,
    realtimeSafety: 60_000,
} as const;
