"use client";

import { useEffect } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { CompanyCalendar } from "@/components/calendar/CompanyCalendar";
import { ReadRecoveryBanner } from "@/components/ui/read-recovery-banner";
import { useCalendarWorkspaceData } from "@/hooks/useCalendarWorkspaceData";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeEvents";
import { canViewCompanyCalendar } from "@/domain/access/roles";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { POLL_INTERVALS } from "@/lib/polling";
import type { User } from "@/types/user";

export default function CalendarPage() {
    const { user, loading } = useUser();
    const { dict } = useDictionary();
    if (loading) return <CalendarLoading />;
    if (!user || !canViewCompanyCalendar(user)) return (
        <main className="dashboard-page-content px-[3%] py-6 md:p-8">
            <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center shadow-sm">
                <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
                <h1 className="mt-3 text-lg font-black text-[var(--text-main)]">{dict.calendar.restricted_title}</h1>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{dict.calendar.restricted_body}</p>
            </section>
        </main>
    );
    return <CalendarWorkspace key={`${user.id}:${user.company_id}:${user.role?.name}`} user={user} />;
}

function CalendarWorkspace({ user }: { user: User }) {
    const { dict } = useDictionary();
    const data = useCalendarWorkspaceData(user);
    const { reload } = data;
    useEffect(() => {
        const timer = window.setTimeout(() => void reload(), 0);
        return () => window.clearTimeout(timer);
    }, [reload]);
    useBackgroundPolling(reload, POLL_INTERVALS.calendar, POLL_INTERVALS.realtimeSafety);
    useRealtimeInvalidation(["calendar", "locations", "reservations", "tasks"], () => { void reload(); });
    if (data.loading && !data.confirmed && !data.error) return <CalendarLoading />;
    return (
        <main className="dashboard-page-content px-[3%] py-6 md:p-8">
            {data.error && <ReadRecoveryBanner kind={data.error} message={data.error === "denied" ? dict.calendar.error_denied : dict.calendar.error_load} retryLabel={dict.calendar.retry} onRetry={() => void reload()} retrying={data.loading} />}
            {data.confirmed && <CompanyCalendar tasks={data.tasks} locations={data.locations} users={data.users} currentUser={user} onTasksChanged={reload} />}
        </main>
    );
}

function CalendarLoading() {
    return <div className="flex min-h-[420px] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;
}
