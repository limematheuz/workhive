"use client";

import { Mail, Phone, MapPin } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";
import { cn } from "@/lib/utils";

type ContactInfoAsideProps = {
    dict: Dictionary;
    isTrialRequest?: boolean;
    supportPhone?: string;
    className?: string;
};

export function ContactInfoAside({
    dict,
    isTrialRequest = false,
    supportPhone,
    className,
}: ContactInfoAsideProps) {
    const t = dict.auth;

    return (
        <div className={cn("space-y-4 lg:col-span-5 lg:space-y-5", className)}>
            <div>
                <h1 className="mb-2 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
                    {isTrialRequest ? t.contact_trial_title : t.contact_title}
                </h1>
                <p className="text-sm leading-relaxed text-[var(--text-muted)] sm:text-base">
                    {isTrialRequest ? t.contact_trial_subtitle : t.contact_subtitle}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
                <div className="billing-block flex gap-3 rounded-2xl border border-[var(--border-soft)] p-3.5 sm:gap-4 sm:p-4">
                    <div className="h-fit rounded-xl border border-accent/25 bg-accent/10 p-2.5 text-accent">
                        <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Email
                        </h3>
                        <a
                            href={`mailto:${t.contact_support_email}`}
                            className="mt-0.5 block break-all text-sm font-semibold text-accent hover:underline"
                        >
                            {t.contact_support_email}
                        </a>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t.contact_email_channel}</p>
                    </div>
                </div>

                <div className="billing-block flex gap-3 rounded-2xl border border-[var(--border-soft)] p-3.5 sm:gap-4 sm:p-4">
                    <div className="h-fit rounded-xl border border-accent/25 bg-accent/10 p-2.5 text-accent">
                        <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {t.contact_phone_label}
                        </h3>
                        <p className="mt-0.5 text-sm font-semibold text-[var(--text-main)]">
                            {supportPhone || t.contact_phone_pending}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t.contact_hours}</p>
                    </div>
                </div>

                <div className="billing-block flex gap-3 rounded-2xl border border-[var(--border-soft)] p-3.5 sm:gap-4 sm:p-4">
                    <div className="h-fit rounded-xl border border-accent/25 bg-accent/10 p-2.5 text-accent">
                        <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {t.contact_location_label}
                        </h3>
                        <p className="mt-0.5 text-sm font-semibold text-[var(--text-main)]">
                            {t.contact_location_value}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
