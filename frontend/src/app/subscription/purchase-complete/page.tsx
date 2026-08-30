"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { AuthGlassCard } from "@/components/auth/AuthGlassCard";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { useDictionary } from "@/lib/dictionary-context";

export default function PurchaseCompletePage() {
    const { dict } = useDictionary();
    const t = dict.subscription;

    return (
        <AuthShell contentClassName="my-auto w-full max-w-xl">
            <AuthGlassCard className="billing-surface border-[var(--border-soft)] p-6 text-center sm:p-8">
                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-accent/25 bg-accent/10 text-accent">
                    <CheckCircle2 className="size-7" aria-hidden="true" />
                </div>
                <h1 className="mt-5 text-2xl font-bold tracking-tight">{t.purchase_complete_title}</h1>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{t.purchase_complete_body}</p>
                <p className="mt-3 text-xs leading-5 text-[var(--text-muted)]">{t.purchase_complete_next}</p>
                <Button asChild variant="secondary" size="lg" className="mt-7">
                    <Link href="/subscription">{t.purchase_complete_back}</Link>
                </Button>
            </AuthGlassCard>
        </AuthShell>
    );
}
