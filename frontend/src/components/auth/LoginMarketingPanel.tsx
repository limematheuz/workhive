import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";
import { AuthLogo } from "@/components/auth/AuthLogo";

type LoginMarketingPanelProps = {
    copy: Dictionary["auth"];
};

export function LoginMarketingPanel({ copy }: LoginMarketingPanelProps) {
    const benefits = [copy.hero_benefit_1, copy.hero_benefit_2, copy.hero_benefit_3];

    return (
        <section className="order-2 hidden min-w-0 flex-1 text-left lg:order-1 lg:block lg:max-w-xl">
            <AuthLogo className="mb-8 w-44 xl:w-52" priority />

            <div className="mb-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/12 px-3 py-1 text-[11px] font-semibold text-accent">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    {copy.feature_tax}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--text-main)]/20 bg-[var(--text-main)]/8 px-3 py-1 text-[11px] font-semibold text-[var(--text-main)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-main)]" />
                    {copy.feature_collab}
                </span>
            </div>

            <h1 className="mb-4 text-4xl font-bold tracking-tight text-[var(--text-main)] xl:mb-5 xl:text-5xl xl:leading-[1.08]">
                {copy.title_hero} <span className="text-accent">{copy.title_hero_accent}</span>
            </h1>
            <p className="mb-8 max-w-lg text-base leading-relaxed text-[var(--text-muted)]">
                {copy.desc_hero}
            </p>

            <ul className="mb-8 max-w-md space-y-3">
                {benefits.map((benefit) => (
                    <li key={benefit} className="flex items-start gap-2.5 text-sm">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <span className="leading-snug text-[var(--text-muted)]">{benefit}</span>
                    </li>
                ))}
            </ul>

            <Link
                href="/subscription"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline ui-motion"
            >
                {copy.free_trial_link}
                <ArrowRight className="h-4 w-4" />
            </Link>
        </section>
    );
}
