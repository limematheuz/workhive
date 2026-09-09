"use client";

import { startTransition, useState, useEffect, useEffectEvent, useMemo } from "react";
import { useUser } from "@/lib/user-context";
import { useDictionary } from "@/lib/dictionary-context";
import { UserService } from "@/services/user.service";
import { LocationService, Location } from "@/services/location.service";
import { InvoiceService } from "@/services/invoice.service";
import { TaskService } from "@/services/task.service";
import { CompanyService } from "@/services/company.service";
import { ActiveCompanySession, UserStatsResponse, WorkSession, TaskItem } from "@/types/user";
import { WorkSessionService } from "@/services/work-session.service";
import { Invoice } from "@/types/invoice";
import { getErrorMessage } from "@/lib/errors";
import { isExternalPortalRole, isPlatformSuperadmin } from "@/domain/access/roles";
import type { CompanyExpense } from "@/types/company";
import { buildCompanyTaskStats } from "@/lib/operations-analytics";

export interface FinancialChartStats {
    labels: string[];
    paid: number[];
    pending: number[];
    overdue: number[];
    expenses: number[];
    hasData: boolean;
}

export interface TaskChartStats {
    labels: string[];
    total: number[];
    completed: number[];
    pending: number[];
    overdue: number[];
    requested?: number[];
    rejected?: number[];
    hasData: boolean;
}

// Date and time formatters
const formatDate = (dateStr: string, locale: string) => {
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
        });
    } catch {
        return dateStr;
    }
};

const formatTime = (dateStr: string | null, locale: string) => {
    if (!dateStr) return "-";
    try {
        const date = new Date(dateStr);
        return date.toLocaleTimeString(locale === "es" ? "es-ES" : "en-US", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
        });
    } catch {
        return dateStr;
    }
};

const calculateDuration = (start: string, end: string | null) => {
    if (!end) return null;
    try {
        const diffMs = new Date(end).getTime() - new Date(start).getTime();
        if (diffMs <= 0) return "0m";
        const mins = Math.floor(diffMs / 60000);
        const hrs = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        if (hrs > 0) {
            return `${hrs}h ${remainingMins}m`;
        }
        return `${remainingMins}m`;
    } catch {
        return "-";
    }
};

export function useProfile() {
    const { user, refreshUser } = useUser();
    const { dict, locale } = useDictionary();

    // Data states
    const [stats, setStats] = useState<UserStatsResponse | null>(null);
    const [sessions, setSessions] = useState<WorkSession[]>([]);
    const [tasks, setTasks] = useState<TaskItem[]>([]);
    const [locations, setLocations] = useState<Location[]>([]);
    const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
    const [allCompanyTasks, setAllCompanyTasks] = useState<TaskItem[]>([]);
    const [companyExpenses, setCompanyExpenses] = useState<CompanyExpense[]>([]);
    const [activeCompanySessions, setActiveCompanySessions] = useState<ActiveCompanySession[]>([]);
    const [companyName, setCompanyName] = useState<string>("");
    const [activeTab, setActiveTab] = useState<"sessions" | "tasks" | "team">("sessions");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Self-profile edit state
    const [isEditing, setIsEditing] = useState(false);

    // Active session timer state
    const [activeSessionTime, setActiveSessionTime] = useState<string>("00:00:00");

    // Calculated metrics for installers
    const myCompletedTasksCount = useMemo(() => tasks.filter(t => t.status === "completed").length, [tasks]);
    // Exclude "requested" (pending company-level acceptance) and "rejected" from operative pending count
    const myPendingTasksCount = useMemo(() => tasks.filter(t => t.status !== "completed" && t.status !== "requested" && t.status !== "rejected").length, [tasks]);
    const myLocationsCount = useMemo(() => new Set(tasks.map(t => t.location_id)).size, [tasks]);

    // Dynamic monthly grouping of finances for Admin (paid vs pending vs overdue)
    const monthlyFinancialStats = useMemo(() => {
        const months = [];
        const paidData = [];
        const pendingData = [];
        const overdueData = [];
        const expenseData = [];
        
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthName = new Date(Date.UTC(d.getFullYear(), d.getMonth(), 1)).toLocaleDateString(
                locale === "es" ? "es-ES" : "en-US",
                { month: "short", timeZone: "UTC" },
            );
            months.push(monthName);
            
            const year = d.getFullYear();
            const month = d.getMonth();
            
            let paidSum = 0;
            let pendingSum = 0;
            let overdueSum = 0;
            let expenseSum = 0;
            
            allInvoices.forEach(inv => {
                try {
                    const invDate = new Date(
                        inv.status === "paid"
                            ? inv.paid_at || inv.issue_date
                            : inv.status === "overdue"
                                ? inv.due_date || inv.issue_date
                                : inv.issue_date,
                    );
                    if (invDate.getFullYear() === year && invDate.getMonth() === month) {
                        if (inv.status === "paid") {
                            paidSum += inv.total_amount;
                        } else if (inv.status === "issued") {
                            pendingSum += inv.total_amount;
                        } else if (inv.status === "overdue") {
                            overdueSum += inv.total_amount;
                        }
                    }
                } catch {}
            });

            companyExpenses.forEach(expense => {
                const expenseDate = new Date(expense.occurred_at);
                if (expenseDate.getFullYear() === year && expenseDate.getMonth() === month) {
                    expenseSum += expense.amount;
                }
            });
            
            paidData.push(paidSum);
            pendingData.push(pendingSum);
            overdueData.push(overdueSum);
            expenseData.push(expenseSum);
        }
        
        const hasData = paidData.some(v => v > 0)
            || pendingData.some(v => v > 0)
            || overdueData.some(v => v > 0)
            || expenseData.some(v => v > 0);
        return {
            labels: months,
            paid: paidData,
            pending: pendingData,
            overdue: overdueData,
            expenses: expenseData,
            hasData,
        };
    }, [allInvoices, companyExpenses, locale]);

    const companyTaskStats = useMemo(
        () => buildCompanyTaskStats(allCompanyTasks, locale),
        [allCompanyTasks, locale],
    );

    // Dynamic self weekly performance for Installer
    const installerWeeklyStats = useMemo(() => {
        const weeks = [];
        const totalData = [];
        const completedData = [];
        const pendingData = [];
        const overdueData = [];
        
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
            const startOfWeek = new Date(now.getTime() - (i * 7 + 7) * 24 * 60 * 60 * 1000);
            const endOfWeek = new Date(now.getTime() - (i * 7) * 24 * 60 * 60 * 1000);
            
            const weekLabel = locale === "es" ? `Sem -${i}` : `Wk -${i}`;
            weeks.push(i === 0 ? (locale === "es" ? "Esta Sem" : "This Wk") : weekLabel);
            
            let totalCount = 0;
            let completedCount = 0;
            let pendingCount = 0;
            let overdueCount = 0;
            
            tasks.forEach(task => {
                try {
                    const taskDate = new Date(task.created_at);
                    if (taskDate >= startOfWeek && taskDate <= endOfWeek) {
                        totalCount++;
                        const normalizedStatus = task.status.toLowerCase().replaceAll("-", "_");
                        if (normalizedStatus === "completed") {
                            completedCount++;
                        } else {
                            const deadline = task.due_at || task.scheduled_start_at;
                            if (deadline && new Date(deadline).getTime() < now.getTime()) {
                                overdueCount++;
                            } else {
                                pendingCount++;
                            }
                        }
                    }
                } catch {}
            });
            
            totalData.push(totalCount);
            completedData.push(completedCount);
            pendingData.push(pendingCount);
            overdueData.push(overdueCount);
        }
        
        return {
            labels: weeks,
            total: totalData,
            completed: completedData,
            pending: pendingData,
            overdue: overdueData,
            hasData: totalData.some(v => v > 0),
        };
    }, [tasks, locale]);

    // Role helpers
    const isAdminOrSuperadmin = user?.role?.name === "admin" || user?.role?.name === "superadmin";
    const isManager = user?.role?.name === "manager";
    const isViewer = user?.role?.name === "viewer";
    const isAccountant = isExternalPortalRole(user?.role?.name);
    const userIsPlatformSuperadmin = isPlatformSuperadmin(user);
    const canLoadOperationalData = !isAccountant && !userIsPlatformSuperadmin;
    const canViewActiveTeam = (isAdminOrSuperadmin || isManager) && !userIsPlatformSuperadmin;

    // Load all profile data
    const loadProfileData = async () => {
        if (!user) return;
        try {
            setLoading(true);
            setError(null);

            const isAdm = user.role?.name === "admin" || user.role?.name === "superadmin";
            const isMgr = user.role?.name === "manager";

            const [userStats, userSessions, userTasks, allLocations, fetchedInvoices, fetchedCompanyTasks, fetchedExpenses] = await Promise.all([
                canLoadOperationalData
                    ? UserService.getUserStats(user.id).catch(() => null)
                    : Promise.resolve(null),
                canLoadOperationalData ? UserService.getUserWorkSessions(10) : Promise.resolve([]),
                canLoadOperationalData ? UserService.getUserTasks(user.id, 100).catch(() => [] as TaskItem[]) : Promise.resolve([]),
                canLoadOperationalData ? LocationService.getLocations() : Promise.resolve([]),
                isAdm && canLoadOperationalData ? InvoiceService.getAllInvoices().catch(() => [] as Invoice[]) : Promise.resolve([] as Invoice[]),
                (isAdm || isMgr) && canLoadOperationalData ? TaskService.getAllTaskItems().catch(() => [] as TaskItem[]) : Promise.resolve([] as TaskItem[]),
                isAdm && user.company_id && canLoadOperationalData
                    ? CompanyService.getCompanyExpenses(user.company_id).catch(() => [] as CompanyExpense[])
                    : Promise.resolve([] as CompanyExpense[])
            ]);

            setStats(userStats);
            setSessions(userSessions);
            setTasks(userTasks);
            setLocations(allLocations);
            setAllInvoices(fetchedInvoices);
            setAllCompanyTasks(fetchedCompanyTasks);
            setCompanyExpenses(fetchedExpenses);

            if (user.company_id && canLoadOperationalData) {
                try {
                    const comp = await CompanyService.getCompany(user.company_id);
                    setCompanyName(comp.name);
                } catch (e) {
                    console.error("Failed to fetch company name:", e);
                }
            } else {
                setCompanyName("");
            }
        } catch (err: unknown) {
            console.error("Error loading profile data:", err);
            setError(getErrorMessage(err, "Failed to load profile data"));
        } finally {
            setLoading(false);
        }
    };

    const loadProfileDataEvent = useEffectEvent(() => {
        void loadProfileData();
    });

    useEffect(() => {
        if (user) {
            startTransition(() => loadProfileDataEvent());
        }
    }, [user]);

    useEffect(() => {
        if (!canViewActiveTeam) {
            startTransition(() => setActiveCompanySessions([]));
            return;
        }
        let cancelled = false;
        const loadActiveTeam = async () => {
            try {
                const data = await WorkSessionService.getActiveCompanySessions();
                if (!cancelled) setActiveCompanySessions(data);
            } catch {
                if (!cancelled) setActiveCompanySessions([]);
            }
        };
        void loadActiveTeam();
        const interval = window.setInterval(loadActiveTeam, 5000);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [canViewActiveTeam]);

    // Mapping of Location ID -> Name to render human-readable names
    const locationsMap = useMemo(() => {
        const map = new Map<number, string>();
        locations.forEach((loc) => {
            map.set(loc.id, loc.name);
        });
        return map;
    }, [locations]);

    const visibleTasks = useMemo(
        () => tasks.filter(
            task =>
                locationsMap.has(task.location_id)
                && !["requested", "rejected", "cancelled"].includes(task.status)
        ),
        [locationsMap, tasks]
    );

    // Find the current active session in the work sessions list
    const activeSession = useMemo(() => {
        return sessions.find(s => s.end_time === null);
    }, [sessions]);

    // Live timer for active session (open shift)
    useEffect(() => {
        if (!activeSession) {
            startTransition(() => setActiveSessionTime("00:00:00"));
            return;
        }

        const updateTimer = () => {
            const start = new Date(activeSession.start_time).getTime();
            const now = new Date().getTime();
            const diffMs = now - start;

            if (diffMs < 0) {
                setActiveSessionTime("00:00:00");
                return;
            }

            const totalSecs = Math.floor(diffMs / 1000);
            const hrs = Math.floor(totalSecs / 3600);
            const mins = Math.floor((totalSecs % 3600) / 60);
            const secs = totalSecs % 60;

            const format = (num: number) => num.toString().padStart(2, "0");
            setActiveSessionTime(`${format(hrs)}:${format(mins)}:${format(secs)}`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);

        return () => clearInterval(interval);
    }, [activeSession]);

    return {
        user,
        refreshUser,
        dict,
        locale,
        stats,
        sessions,
        tasks: visibleTasks,
        locations,
        allInvoices,
        allCompanyTasks,
        activeCompanySessions,
        companyName,
        activeTab,
        setActiveTab,
        loading,
        error,
        isEditing,
        setIsEditing,
        activeSessionTime,
        myCompletedTasksCount,
        myPendingTasksCount,
        myLocationsCount,
        monthlyFinancialStats,
        companyTaskStats,
        installerWeeklyStats,
        isAdminOrSuperadmin,
        isManager,
        isViewer,
        isAccountant,
        canViewActiveTeam,
        loadProfileData,
        locationsMap,
        activeSession,
        formatDate: (dateStr: string) => formatDate(dateStr, locale),
        formatTime: (dateStr: string | null) => formatTime(dateStr, locale),
        calculateDuration,
    };
}
