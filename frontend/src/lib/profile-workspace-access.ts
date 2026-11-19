export function isInternalProfile(user: { company_id?: number | null; role: { name: string } }): boolean {
    return Boolean(user.company_id) && ["admin", "manager", "viewer"].includes(user.role.name);
}

export function profileActivityAccess(permissions: Record<string, boolean>) {
    return { sessions: permissions["time.manage"] === true, tasks: permissions["work.read"] === true,
        locations: permissions["locations.read"] === true, team: permissions["time.read"] === true,
        finance: permissions["finance.read"] === true };
}
