"use client";

import { useState, useEffect } from "react";
import { redirect, useRouter } from "next/navigation";
import { useDictionary } from "@/lib/dictionary-context";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { clearSessionCache } from "@/lib/auth";
import { authService } from "@/services/auth.service";
import { UserProvider, useUser } from "@/lib/user-context";
import { useThemeMode } from "@/lib/theme";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { CompanyService } from "@/services/company.service";

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
    const { user, loading } = useUser();
    const { dict } = useDictionary();
    const [showOnboarding, setShowOnboarding] = useState(false);

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
        if (!user.company_id || user.role?.name !== "admin") {
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
            <div className="flex h-screen items-center justify-center bg-[var(--bg-primary)]">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-accent border-b-transparent" />
                    <p className="text-sm text-[var(--text-muted)]">
                        {dict.dashboard.loading || "Loading..."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-[var(--bg-primary)] flex text-[var(--text-main)] font-sans transition-colors duration-300 overflow-hidden">

            {/* Mobile overlay */}
            {isSidebarOpen && (
                <button
                    type="button"
                    aria-label="Close sidebar"
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar
                isOpen={isSidebarOpen}
                theme={theme}
                onThemeChange={setTheme}
                onLogout={handleLogout}
            />

            <div className="flex-1 h-screen overflow-hidden p-0 lg:py-4 lg:pr-4 lg:pl-0 transition-colors duration-300">
                <div className="relative flex flex-col h-full bg-[var(--bg-primary)] rounded-none lg:rounded-3xl border-0 lg:border border-[var(--border-soft)] overflow-hidden">
                    <div className="dashboard-shell-backlight" />
                    <DashboardHeader
                        isSidebarOpen={isSidebarOpen}
                        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    />

                    <main className="relative z-10 flex-1 overflow-auto p-0 min-h-0">
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
