"use client";

import { useState, useEffect } from "react";
import { redirect, usePathname, useRouter } from "next/navigation";
import { useDictionary } from "@/lib/dictionary-context";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { clearSessionCache } from "@/lib/auth";
import { authService } from "@/services/auth.service";
import { UserProvider, useUser } from "@/lib/user-context";
import { useThemeMode } from "@/lib/theme";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { CompanyService } from "@/services/company.service";
import { shouldShowCompanyOnboarding } from "@/domain/onboarding/cleaning-onboarding";
import { isAccountantRole } from "@/domain/access/roles";
import { canAccessAccountantDashboardPath } from "@/domain/access/accountant-dashboard";

export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
    return (
        <UserProvider>
            <DashboardLayout>{children}</DashboardLayout>
        </UserProvider>
    );
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [theme, setTheme] = useThemeMode();
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading } = useUser();
    const { dict } = useDictionary();
    const [showOnboarding, setShowOnboarding] = useState(false);
    const isAccountant = isAccountantRole(user?.role?.name);

    useEffect(() => {
        const mediaQuery = window.matchMedia("(min-width: 1024px)");
        const syncSidebar = () => setIsSidebarOpen(mediaQuery.matches);

        syncSidebar();
        mediaQuery.addEventListener("change", syncSidebar);

        return () => mediaQuery.removeEventListener("change", syncSidebar);
    }, []);

    // Listen to custom event to open/close sidebar programmatically
    useEffect(() => {
        const handleOpenSidebar = (e: Event) => {
            const customEvent = e as CustomEvent;
            setIsSidebarOpen(customEvent.detail ?? true);
        };
        window.addEventListener("workhive_set_sidebar_open", handleOpenSidebar);
        return () => window.removeEventListener("workhive_set_sidebar_open", handleOpenSidebar);
    }, []);

    // Check if onboarding should be shown
    useEffect(() => {
        if (!user || loading) return;

        // Accounts and admin permissions are provisioned by WorkHive.
        if (!shouldShowCompanyOnboarding(user)) {
            return;
        }

        const userOnboardingKey = `workhive_onboarding_done_${user.id}`;
        const forced = localStorage.getItem(`workhive_onboarding_forced_${user.id}`) === "true";

        if (forced) {
            queueMicrotask(() => setShowOnboarding(true));
            return;
        }

        CompanyService.getCompany(user.company_id)
            .then((company) => {
                if (company.onboarding_completed) {
                    localStorage.setItem(userOnboardingKey, "true");
                    setShowOnboarding(false);
                    return;
                }
                localStorage.removeItem(userOnboardingKey);
                setShowOnboarding(true);
            })
            .catch(() => {});
    }, [user, loading]);

    const handleLogout = async () => {
        try {
            await authService.logout();
        } finally {
            clearSessionCache();
            router.replace("/login");
        }
    };

    if (!loading && !user) {
        redirect("/login");
    }

    if (loading || !user) {
        return (
            <div className="flex h-dvh items-center justify-center bg-[var(--bg-primary)]">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-accent border-b-transparent" />
                    <p className="text-sm text-[var(--text-muted)]">
                        {dict.dashboard.loading || "Loading..."}
                    </p>
                </div>
            </div>
        );
    }

    if (isAccountant && !canAccessAccountantDashboardPath(pathname)) {
        redirect("/dashboard/analytics");
    }

    return (
        <div className="flex min-h-dvh bg-[var(--bg-primary)] font-sans text-[var(--text-main)] transition-colors duration-300 lg:h-dvh lg:overflow-hidden">

            {/* Mobile overlay */}
            {isSidebarOpen && (
                <button
                    type="button"
                    aria-label="Close sidebar"
                    className="fixed inset-0 z-[var(--z-sidebar-overlay)] bg-black/50 backdrop-blur-sm transition-opacity lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar
                isOpen={isSidebarOpen}
                theme={theme}
                onThemeChange={setTheme}
            />

            <div className="min-h-dvh min-w-0 flex-1 overflow-visible p-0 transition-colors duration-300 lg:h-dvh lg:overflow-hidden lg:py-4 lg:pl-0 lg:pr-4">
                <div className="relative flex min-h-dvh min-w-0 flex-col bg-[var(--bg-primary)] lg:h-full lg:min-h-0 lg:overflow-hidden lg:rounded-3xl lg:border lg:border-[var(--border-soft)]">
                    {/* Clip backlight bleed without making this shell a touch scrollport (AuthShell pattern). */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                        <div className="dashboard-shell-backlight" />
                    </div>
                    <DashboardHeader
                        isSidebarOpen={isSidebarOpen}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                        onLogout={handleLogout}
                    />

                    <main className="dashboard-page-scroll-region relative z-[var(--z-dashboard-content)] min-h-0 min-w-0 flex-1 overflow-x-hidden p-0 lg:overflow-y-auto">
                        {children}
                    </main>
                </div>
            </div>


            {showOnboarding && user && (
                <OnboardingModal
                    user={user}
                    onComplete={() => setShowOnboarding(false)}
                />
            )}
        </div>
    );
}
