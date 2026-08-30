"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDictionary } from "@/lib/dictionary-context";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthLogo } from "@/components/auth/AuthLogo";
import { PremiumTabs } from "@/components/ui/premium-tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Building2, User } from "lucide-react";

function RegisterPageContent() {
    const router = useRouter();
    const { dict } = useDictionary();
    const t = dict.auth;

    return (
        <AuthShell contentClassName="my-auto w-full max-w-xl">
            <AuthGlassCard className="billing-surface border-[var(--border-soft)] p-5 sm:p-6">
                <div className="mb-4">
                    <AuthLogo className="w-28 sm:w-36" priority />
                </div>

                <PremiumTabs
                    layout="fit"
                    tabs={[
                        { id: "login", label: t.sign_in },
                        { id: "register", label: t.request_access },
                    ]}
                    activeTab="register"
                    onChange={(id) => {
                        if (id === "login") router.push("/login");
                    }}
                    className="mb-4"
                />

                <h1 className="mb-1.5 text-xl font-bold tracking-tight text-[var(--text-main)] sm:text-2xl">
                    {t.register_title}
                </h1>
                <p className="mb-4 text-sm leading-relaxed text-[var(--text-muted)]">
                    {t.register_subtitle}
                </p>

                <div className="space-y-2.5 border-t border-[var(--border-soft)] pt-4">
                    <div className="billing-block flex min-w-0 gap-3 rounded-2xl border border-[var(--border-soft)] p-3.5 sm:gap-3.5 sm:p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                            <User className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 space-y-1">
                            <h3 className="text-sm font-semibold text-[var(--text-main)]">
                                {t.register_worker_title}
                            </h3>
                            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                                {t.register_worker_desc}
                            </p>
                        </div>
                    </div>

                    <Link
                        href="/subscription"
                        className="billing-block group flex min-w-0 gap-3 rounded-2xl border border-[var(--border-soft)] p-3.5 ui-motion hover:border-accent/35 sm:gap-3.5 sm:p-4"
                    >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/25 bg-accent/10 text-accent">
                            <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-main)]">
                                {t.register_company_title}
                                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent opacity-70 transition-transform group-hover:translate-x-0.5" />
                            </h3>
                            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                                {t.register_company_desc}
                            </p>
                        </div>
                    </Link>
                </div>

                <div className="mt-4 flex flex-col gap-2.5 border-t border-[var(--border-soft)] pt-4 sm:mt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                    <Button asChild variant="secondary" size="lg" className="h-12 w-full rounded-2xl sm:h-11 sm:w-auto">
                        <Link href="/login">
                            <ArrowLeft className="h-4 w-4" />
                            {t.sign_in}
                        </Link>
                    </Button>
                    <div className="flex min-w-0 flex-col gap-2.5 sm:flex-row sm:gap-3">
                        <Button asChild size="lg" className="h-12 w-full rounded-2xl sm:h-11 sm:w-auto">
                            <Link href="/subscription">{t.see_plans}</Link>
                        </Button>
                        <Button asChild variant="secondary" size="lg" className="h-12 w-full rounded-2xl sm:h-11 sm:w-auto">
                            <Link href="/contact">{t.contact_cta}</Link>
                        </Button>
                    </div>
                </div>
            </AuthGlassCard>
        </AuthShell>
    );
}

export default function RegisterPage() {
    const { dict } = useDictionary();
    return (
        <Suspense
            fallback={
                <div className="flex min-h-dvh items-center justify-center bg-[var(--bg-primary)] text-[var(--text-muted)]">
                    {dict.auth.loading}
                </div>
            }
        >
            <RegisterPageContent />
        </Suspense>
    );
}
