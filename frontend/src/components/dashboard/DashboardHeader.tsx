"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { UserAvatar } from "@/components/ui/user-avatar";
import { NotificationPanel } from "./notifications/NotificationPanel";

interface DashboardHeaderProps {
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
}

export function DashboardHeader({ onToggleSidebar }: DashboardHeaderProps) {
    const { dict } = useDictionary();
    const pathname = usePathname();
    const { user } = useUser();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setIsProfileOpen(false);
            }
        }
        if (isProfileOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isProfileOpen]);

    const pageTitle = pathname === "/dashboard"
            ? dict.dashboard.overview
            : pathname.includes("/dashboard/analytics")
                ? dict.finance_analytics.eyebrow
            : pathname.includes("/dashboard/expenses")
                ? dict.expenses.title
            : pathname.includes("/dashboard/traffic")
                ? (dict.traffic?.title || "Tráfico")
            : pathname.includes("/dashboard/profile")
                ? dict.dashboard.profile
            : pathname.includes("/dashboard/live-work")
                ? (dict.dashboard.live_work || "Fichajes en vivo")
            : pathname.includes("/dashboard/calendar")
                ? dict.dashboard.calendar
            : pathname.includes("/dashboard/clients")
                ? dict.dashboard.clients
                : pathname.includes("/dashboard/locations")
                    ? dict.dashboard.locations
                    : pathname.includes("/dashboard/tasks")
                        ? dict.dashboard.tasks
                        : pathname.includes("/dashboard/invoices")
                            ? dict.dashboard.invoices
                            : pathname.includes("/dashboard/companies")
                                ? dict.dashboard.companies
                                : pathname.includes("/dashboard/roles")
                                    ? dict.dashboard.roles
                                    : dict.dashboard.overview;

    return (
        <header className="relative z-50 h-20 flex items-center justify-between px-[3%] md:px-8 border-b border-[var(--border-soft)] bg-transparent transition-colors duration-300">
            <div className="flex items-center gap-4">
                <button
                    type="button"
                    onClick={onToggleSidebar}
                    className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                    aria-label="Toggle sidebar"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v18" />
                    </svg>
                </button>
                <h1 className="text-xl font-semibold text-[var(--text-main)]">{pageTitle}</h1>
            </div>

            <div className="flex items-center gap-6">
                <NotificationPanel />

                <div className="relative" ref={profileRef}>
                    <button
                        type="button"
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        aria-label="Abrir menú de perfil"
                        className="w-10 h-10 rounded-full border border-[var(--border-color)] bg-[var(--bg-tertiary)] flex items-center justify-center font-bold hover:border-accent cursor-pointer transition-all text-xs text-[var(--text-main)] overflow-hidden"
                    >
                        <UserAvatar
                            name={user?.full_name}
                            email={user?.email}
                            photoUrl={user?.photo_url}
                            className="h-full w-full border-0 text-[11px]"
                            textClassName="text-[11px]"
                        />
                    </button>
                    {isProfileOpen && user && (
                        <div className="absolute right-0 mt-2 w-56 rounded-3xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] shadow-2xl p-6 z-[10050] flex flex-col gap-2 transition-all">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-sm font-semibold text-[var(--text-main)] truncate">
                                    {user.full_name || dict.dashboard.default_user_name || "Usuario"}
                                </span>
                                <span className="text-xs text-[var(--text-muted)] truncate">
                                    {user.email}
                                </span>
                            </div>
                            <div className="border-t border-[var(--border-soft)] pt-2 mt-1 flex flex-col gap-2">
                                <span className="text-2xs font-bold text-accent uppercase tracking-wider bg-accent/10 px-2.5 py-1 rounded-full w-fit">
                                    {user.role?.name || dict.dashboard.no_role || "Sin Rol"}
                                </span>
                                <Link
                                    href="/dashboard/profile"
                                    onClick={() => setIsProfileOpen(false)}
                                    className="text-sm text-[var(--text-muted)] hover:text-accent transition-colors text-left"
                                >
                                    {dict.dashboard.view_profile}
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
