"use client";

import { useState, useEffect } from "react";
import { redirect, usePathname, useRouter } from "next/navigation";
import { useDictionary } from "@/lib/dictionary-context";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { clearSessionCache } from "@/lib/auth";
import { authService } from "@/services/auth.service";
import { UserProvider, useUser } from "@/lib/user-context";
import { useThemeMode } from "@/lib/theme";
import { OnboardingModal } from "@/components/onboarding/OnboardingModal";
import { CompanyService } from "@/services/company.service";
import { shouldShowCompanyOnboarding } from "@/domain/onboarding/cleaning-onboarding";
import { isAccountantRole } from "@/domain/access/roles";
import { canAccessAccountantDashboardPath } from "@/domain/access/accountant-dashboard";
import { NoWorkspaceAccount } from "@/components/dashboard/NoWorkspaceAccount";

export default function DashboardLayoutWrapper({ children }: { children: React.ReactNode }) {
    return (
        <UserProvider>
            <DashboardLayout>{children}</DashboardLayout>
        </UserProvider>
    );
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [theme, setTheme] = useThemeMode();
    const router = useRouter();
    const pathname = usePathname();
    const { user, loading } = useUser();
    const { dict } = useDictionary();
    const [showOnboarding, setShowOnboarding] = useState(false);
    const isAccountant = isAccountantRole(user?.role?.name);

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

    if (user.company_id == null && user.role?.name !== "superadmin") {
        return <NoWorkspaceAccount onLogout={() => { void handleLogout(); }} />;
    }

    if (isAccountant && !canAccessAccountantDashboardPath(pathname)) {
        redirect("/dashboard/analytics");
    }

    return <SidebarProvider defaultOpen>
        <DashboardLayoutShell theme={theme} onThemeChange={setTheme} onLogout={handleLogout} showOnboarding={showOnboarding} onOnboardingComplete={() => setShowOnboarding(false)} user={user}>{children}</DashboardLayoutShell>
    </SidebarProvider>;
}

function DashboardLayoutShell({ children, theme, onThemeChange, onLogout, showOnboarding, onOnboardingComplete, user }: { children: React.ReactNode; theme: "dark" | "light"; onThemeChange: (theme: "dark" | "light") => void; onLogout: () => void; showOnboarding: boolean; onOnboardingComplete: () => void; user: NonNullable<ReturnType<typeof useUser>["user"]> }) {
    const { isMobile, setOpen, setOpenMobile } = useSidebar();
    useEffect(() => {
        const handleOpenSidebar = (event: Event) => {
            const requested = (event as CustomEvent<boolean | undefined>).detail ?? true;
            if (isMobile) setOpenMobile(requested);
            else setOpen(requested);
        };
        window.addEventListener("workhive_set_sidebar_open", handleOpenSidebar);
        return () => window.removeEventListener("workhive_set_sidebar_open", handleOpenSidebar);
    }, [isMobile, setOpen, setOpenMobile]);

    return (
        <>
            <Sidebar theme={theme} onThemeChange={onThemeChange} onLogout={onLogout} />

            <main className="min-h-dvh min-w-0 flex-1 overflow-visible p-0 transition-colors duration-300 lg:h-dvh lg:overflow-hidden lg:py-4 lg:pl-0 lg:pr-4">
                <div className="relative flex min-h-dvh min-w-0 flex-col bg-[var(--bg-primary)] lg:h-full lg:min-h-0 lg:overflow-hidden lg:rounded-3xl lg:border lg:border-[var(--border-soft)]">
                    {/* Clip backlight bleed without making this shell a touch scrollport (AuthShell pattern). */}
                    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
                        <div className="dashboard-shell-backlight" />
                    </div>
                    <DashboardHeader
                    />

                    <main className="dashboard-page-scroll-region relative z-[var(--z-dashboard-content)] min-h-0 min-w-0 flex-1 overflow-x-hidden p-0 lg:overflow-y-auto">
                        {children}
                    </main>
                </div>
            </main>


            {showOnboarding && (
                <OnboardingModal
                    user={user}
                    onComplete={onOnboardingComplete}
                />
            )}
        </>
    );
}
