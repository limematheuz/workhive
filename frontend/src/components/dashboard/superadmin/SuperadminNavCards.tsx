"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import {
    Building2,
    CloudCog,
    KeyRound,
    Radio,
    Users,
} from "lucide-react";

import { useDictionary } from "@/lib/dictionary-context";

type NavItem = {
    href: string;
    title: string;
    description: string;
    icon: ComponentType<{ className?: string }>;
};

export function SuperadminNavCards() {
    const { dict } = useDictionary();
    const text = dict.superadmin;

    const items: NavItem[] = [
        {
            href: "/dashboard/companies",
            title: dict.dashboard.companies,
            description: text.nav_companies_desc,
            icon: Building2,
        },
        {
            href: "/dashboard/users",
            title: dict.users.title,
            description: text.nav_team_desc,
            icon: Users,
        },
        {
            href: "/dashboard/roles",
            title: dict.dashboard.roles,
            description: text.nav_roles_desc,
            icon: KeyRound,
        },
        {
            href: "/dashboard/traffic",
            title: dict.dashboard.traffic,
            description: text.nav_traffic_desc,
            icon: Radio,
        },
        {
            href: "/dashboard/integrations",
            title: dict.dashboard.integrations,
            description: text.nav_integrations_desc,
            icon: CloudCog,
        },
    ];

    return (
        <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
                <h2 className="text-sm font-bold text-[var(--text-main)]">
                    {text.section_nav}
                </h2>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="billing-block group flex gap-3 rounded-[18px] border border-[var(--border-soft)] p-3.5 ui-motion hover:border-accent/40 hover:shadow-[0_10px_24px_rgba(52,74,94,0.08)]"
                        >
                            <span
                                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--brand-blue-border)] bg-[var(--brand-blue-soft)] text-accent"
                                aria-hidden="true"
                            >
                                <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0">
                                <span className="block text-sm font-bold text-[var(--text-main)] group-hover:text-accent">
                                    {item.title}
                                </span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-muted)]">
                                    {item.description}
                                </span>
                            </span>
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
