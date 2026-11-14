"use client";

import React, { useEffect, useState, Suspense } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { TechDashboard } from "@/components/dashboard/TechDashboard";
import { SuperadminDashboard } from "@/components/dashboard/superadmin/SuperadminDashboard";
import { GuidedTour } from "@/components/onboarding/GuidedTour";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { useDashboardOverviewData } from "@/hooks/useDashboardOverviewData";
import { Button } from "@/components/ui/button";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeEvents";
import { POLL_INTERVALS } from "@/lib/polling";
import { isPlatformSuperadmin } from "@/domain/access/roles";

function DashboardOverviewContent() {
    const { dict } = useDictionary();
    const { user, loading: loadingUser } = useUser();

    const { tasks, locations, loadingData, failed, accessDenied, taskFailed, loadDashboardData, loadDashboardTasks, loadDashboardLocations } = useDashboardOverviewData(user);
    const error = [failed ? dict.dashboard.error_load_data : null, accessDenied ? dict.dashboard.access_denied : null].filter(Boolean).join(" ");
    const [showGuidedTour, setShowGuidedTour] = useState<boolean>(false);
    const userIsPlatformSuperadmin = isPlatformSuperadmin(user);
    useBackgroundPolling(
        () => userIsPlatformSuperadmin ? Promise.resolve() : loadDashboardData(),
        POLL_INTERVALS.dashboard,
        POLL_INTERVALS.realtimeSafety,
    );
    useRealtimeInvalidation(["tasks"], () => {
        if (!userIsPlatformSuperadmin) void loadDashboardTasks();
    });
    useRealtimeInvalidation(["locations"], () => {
        if (!userIsPlatformSuperadmin) void loadDashboardLocations();
    });
    // Older API workers can still emit this broad topic during a rolling deploy.
    useRealtimeInvalidation(["dashboard"], () => {
        if (!userIsPlatformSuperadmin) void loadDashboardData();
    });

    useEffect(() => {
        const checkTour = () => {
            if (!user) return;

            const isAdmin = user.role?.name === "admin" || user.role?.name === "superadmin";
            if (!isAdmin) return;

            const userOnboardingKey = `workhive_onboarding_done_${user.id}`;
            const userTourKey = `workhive_guided_tour_done_${user.id}`;

            const onboardingDone = localStorage.getItem(userOnboardingKey) === "true";
            const tourDone = localStorage.getItem(userTourKey) === "true";

            if (onboardingDone && !tourDone) {
                localStorage.setItem(userTourKey, "true");
                setShowGuidedTour(false);
            }
        };

        checkTour();

        window.addEventListener("workhive_onboarding_completed", checkTour);
        return () => window.removeEventListener("workhive_onboarding_completed", checkTour);
    }, [user]);

    if (loadingUser || (loadingData && tasks.length === 0)) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-xs text-[var(--text-muted)] font-medium">
                    {dict.dashboard.syncing}
                </p>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="p-8 text-center bg-[var(--bg-card)] border border-[var(--border-soft)] rounded-2xl">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
                <p className="text-sm font-semibold text-[var(--text-main)]">
                    {dict.dashboard.login_required}
                </p>
            </div>
        );
    }

    if (userIsPlatformSuperadmin) {
        return <SuperadminDashboard />;
    }

    return (
        <>
            {error && (
                <div className="mx-auto w-full min-w-0 max-w-7xl px-[max(3%,env(safe-area-inset-left))] pr-[max(3%,env(safe-area-inset-right))] pt-6 md:px-8">
                    <div role="alert" data-dashboard-read-error className="flex flex-wrap items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-500">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 [overflow-wrap:anywhere]">{error}</span>
                        {failed && <Button type="button" variant="outline" size="sm" onClick={() => void loadDashboardData()}>{dict.dashboard.retry_load_data}</Button>}
                    </div>
                </div>
            )}

            {!(taskFailed && tasks.length === 0) && <TechDashboard
                currentUser={user}
                tasks={tasks}
                locations={locations}
                onTaskUpdate={loadDashboardData}
            />}

            {showGuidedTour && (
                <GuidedTour
                    user={user}
                    onComplete={() => setShowGuidedTour(false)}
                />
            )}
        </>
    );
}

export default function DashboardOverview() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-xs text-[var(--text-muted)] font-medium">Sincronizando...</p>
            </div>
        }>
            <DashboardOverviewContent />
        </Suspense>
    );
}
