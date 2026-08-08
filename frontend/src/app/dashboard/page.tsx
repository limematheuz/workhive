"use client";

import React, { startTransition, useCallback, useEffect, useState, Suspense } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { TechDashboard } from "@/components/dashboard/TechDashboard";
import { SuperadminDashboard } from "@/components/dashboard/superadmin/SuperadminDashboard";
import { GuidedTour } from "@/components/onboarding/GuidedTour";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { LocationService, Location } from "@/services/location.service";
import { TaskService, TaskItem } from "@/services/task.service";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";
import { isPlatformSuperadmin } from "@/domain/access/roles";

const mergeLocations = (base: Location[], extra: Location[]) => {
    const byId = new Map<number, Location>();
    [...base, ...extra].forEach((location) => byId.set(location.id, location));
    return Array.from(byId.values());
};

function DashboardOverviewContent() {
    const { dict } = useDictionary();
    const { user, loading: loadingUser } = useUser();

    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [loadingData, setLoadingData] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showGuidedTour, setShowGuidedTour] = useState<boolean>(false);
    const userIsPlatformSuperadmin = isPlatformSuperadmin(user);

    const loadDashboardData = useCallback(async (silent = false) => {
        if (!user) return;
        if (user.role?.name === "superadmin" && !user.company_id) {
            setTasks([]);
            setLocations([]);
            setLoadingData(false);
            return;
        }

        try {
            if (!silent) {
                setLoadingData(true);
                setError(null);
            }

            const [fetchedLocs, fetchedTasks] = await Promise.all([
                LocationService.getLocations().catch(() => [] as Location[]),
                TaskService.getAllTaskItems().catch(() => [] as TaskItem[]),
            ]);

            const knownLocationIds = new Set(fetchedLocs.map((location) => location.id));
            const missingLocationIds = Array.from(
                new Set(
                    fetchedTasks.flatMap((task) =>
                        knownLocationIds.has(task.location_id) ? [] : [task.location_id]
                    )
                )
            );
            const missingLocations = (
                await Promise.all(
                    missingLocationIds.map((locationId) =>
                        LocationService.getLocation(locationId).catch(() => null)
                    )
                )
            ).filter((location): location is Location => Boolean(location));

            setLocations(mergeLocations(fetchedLocs, missingLocations));
            setTasks(fetchedTasks);
        } catch (err) {
            console.error("Error loading dashboard data", err);
            if (!silent) setError(dict.dashboard.error_load_data);
        } finally {
            setLoadingData(false);
        }
    }, [user, dict.dashboard.error_load_data]);

    useEffect(() => {
        if (user) {
            startTransition(() => {
                void loadDashboardData();
            });
        }
    }, [user, loadDashboardData]);

    useBackgroundPolling(
        () => userIsPlatformSuperadmin ? Promise.resolve() : loadDashboardData(true),
        POLL_INTERVALS.dashboard,
    );

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
                    <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-semibold text-red-500">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 [overflow-wrap:anywhere]">{error}</span>
                    </div>
                </div>
            )}

            <TechDashboard
                currentUser={user}
                tasks={tasks}
                locations={locations}
                onTaskUpdate={loadDashboardData}
            />

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
