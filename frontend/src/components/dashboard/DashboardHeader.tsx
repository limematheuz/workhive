"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { useDictionary } from "@/lib/dictionary-context";
import { useUser } from "@/lib/user-context";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotificationPanel } from "./notifications/NotificationPanel";

interface DashboardHeaderProps {
    isSidebarOpen: boolean;
    onToggleSidebar: () => void;
    onLogout: () => void;
}

export function DashboardHeader({ onToggleSidebar, onLogout }: DashboardHeaderProps) {
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
            : pathname.includes("/dashboard/fiscal-summary")
                ? dict.fiscal_summary.title
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
            : pathname.includes("/dashboard/integrations")
                ? dict.dashboard.integrations
            : pathname.includes("/dashboard/clients")
                ? dict.dashboard.clients
                : pathname.includes("/dashboard/locations")
                    ? dict.dashboard.locations
                    : pathname.includes("/dashboard/tasks")
                        ? dict.dashboard.tasks
                        : pathname.includes("/dashboard/invoice-summary")
                            ? dict.invoices.summary_nav
                        : pathname.includes("/dashboard/invoices")
                            ? dict.dashboard.invoices
                            : pathname.includes("/dashboard/companies")
                                ? dict.dashboard.companies
                                : pathname.includes("/dashboard/roles")
                                    ? dict.dashboard.roles
                                    : dict.dashboard.overview;

    return (
        <header className="relative z-[var(--z-header)] flex h-20 min-w-0 items-center justify-between gap-3 border-b border-[var(--border-soft)] bg-transparent px-[max(3%,env(safe-area-inset-left))] pr-[max(3%,env(safe-area-inset-right))] transition-colors duration-300 md:px-8">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <button
                    type="button"
                    onClick={onToggleSidebar}
                    className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                    aria-label="Toggle sidebar"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeWidth={2} />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v18" />
                    </svg>
                </button>
                <h1 className="min-w-0 truncate text-lg font-semibold text-[var(--text-main)] sm:text-xl">{pageTitle}</h1>
            </div>

            <div className="flex shrink-0 items-center gap-3 sm:gap-6">
                <NotificationPanel />

                <div className="relative" ref={profileRef}>
                    <button
                        type="button"
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        aria-label="Abrir menú de perfil"
                        className="w-10 h-10 rounded-full border border-[var(--border-color)] bg-[var(--bg-tertiary)] flex items-center justify-center font-bold hover:border-accent cursor-pointer ui-motion text-xs text-[var(--text-main)] overflow-hidden"
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
                        <div
                            className="billing-surface header-popover-layer fixed left-3 right-3 top-20 max-w-[calc(100vw-1.5rem)] rounded-[24px] p-3 ui-motion sm:left-auto sm:right-8 sm:w-[min(25rem,calc(100vw-2rem))]"
                            role="menu"
                            aria-label="Menú de perfil"
                        >
                            <div className="min-w-0 pb-2">
                                <p className="truncate text-sm font-semibold text-[var(--text-main)]">
                                    {dict.dashboard.profile || "Perfil"}
                                </p>
                                <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                                    {user.full_name || dict.dashboard.default_user_name || "Usuario"}
                                </p>
                            </div>

                            <div className="billing-block rounded-xl border border-[var(--border-soft)] p-2.5">
                                <div className="flex items-center gap-2.5">
                                    <UserAvatar
                                        name={user.full_name}
                                        email={user.email}
                                        photoUrl={user.photo_url}
                                        className="h-9 w-9 shrink-0 border border-[var(--border-soft)] text-[11px]"
                                        textClassName="text-[11px]"
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-[var(--text-main)]">
                                            {user.full_name || dict.dashboard.default_user_name || "Usuario"}
                                        </p>
                                        <p className="mt-0.5 truncate text-[11px] text-[var(--text-muted)]">
                                            {user.email}
                                        </p>
                                        <Badge
                                            variant="secondary"
                                            className="mt-1 text-[10px] font-bold uppercase tracking-wide"
                                        >
                                            {user.role?.name || dict.dashboard.no_role || "Sin Rol"}
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-2 flex flex-col gap-1.5">
                                <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start hover:translate-y-0"
                                >
                                    <Link
                                        href="/dashboard/profile"
                                        onClick={() => setIsProfileOpen(false)}
                                        role="menuitem"
                                    >
                                        <User className="h-4 w-4 shrink-0" aria-hidden="true" />
                                        {dict.dashboard.view_profile}
                                    </Link>
                                </Button>
                                <Button
                                    type="button"
                                    role="menuitem"
                                    variant="dangerSoft"
                                    size="sm"
                                    aria-label={dict.dashboard.logout}
                                    className="w-full justify-start hover:translate-y-0"
                                    onClick={() => {
                                        setIsProfileOpen(false);
                                        onLogout();
                                    }}
                                >
                                    <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
                                    {dict.dashboard.logout}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
