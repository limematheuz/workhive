"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

import { CompanyCalendar } from "@/components/calendar/CompanyCalendar";
import { authService } from "@/services/auth.service";
import { Location, LocationService } from "@/services/location.service";
import { TaskItem, TaskService } from "@/services/task.service";
import { UserService } from "@/services/user.service";
import { User } from "@/types/user";
import { useBackgroundPolling } from "@/hooks/useBackgroundPolling";
import { POLL_INTERVALS } from "@/lib/polling";
import {
    canViewCompanyCalendar,
    isSuperadmin,
} from "@/domain/access/roles";


export default function CalendarPage() {
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        const me = await authService.getMe();
        setCurrentUser(me);
        if (!canViewCompanyCalendar(me)) {
            setTasks([]);
            setLocations([]);
            setUsers([]);
            return;
        }
        const [loadedTasks, loadedLocations, loadedUsers] = await Promise.all([
            TaskService.getTaskItems({ limit: 500 }),
            LocationService.getLocations(),
            UserService.getUsers(0, 500).catch(() => [me]),
        ]);
        setTasks(loadedTasks);
        setLocations(loadedLocations);
        setUsers(loadedUsers.filter((user) => !isSuperadmin(user)));
    }, []);

    useEffect(() => {
        const initialLoad = window.setTimeout(() => {
            void loadData()
                .catch((error) => {
                    console.error("Error loading calendar data", error);
                })
                .finally(() => setLoading(false));
        }, 0);
        return () => window.clearTimeout(initialLoad);
    }, [loadData]);

    useBackgroundPolling(loadData, POLL_INTERVALS.calendar);

    if (loading) {
        return (
            <div className="flex min-h-[420px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
        );
    }

    const canView = canViewCompanyCalendar(currentUser);
    if (!canView) {
        return (
            <main className="h-full overflow-y-auto px-[3%] py-6 md:p-8">
                <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-8 text-center shadow-sm">
                    <ShieldAlert className="mx-auto h-10 w-10 text-amber-500" />
                    <h1 className="mt-3 text-lg font-black text-[var(--text-main)]">Calendario restringido</h1>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                        No tienes permisos para ver el calendario de la empresa.
                    </p>
                </section>
            </main>
        );
    }

    return (
        <main className="h-full overflow-y-auto px-[3%] py-6 md:p-8">
            <CompanyCalendar
                tasks={tasks}
                locations={locations}
                users={users}
                currentUser={currentUser}
                onTasksChanged={loadData}
            />
        </main>
    );
}
