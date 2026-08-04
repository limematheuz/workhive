"use client";

import { Mail, Phone, MapPin } from "lucide-react";
import type { Dictionary } from "@/lib/dictionary-context";

type ContactInfoAsideProps = {
    dict: Dictionary;
    isTrialRequest?: boolean;
    supportPhone?: string;
};

export function ContactInfoAside({
    dict,
    isTrialRequest = false,
    supportPhone,
}: ContactInfoAsideProps) {
    const t = dict.auth;

    return (
        <div className="space-y-6 lg:col-span-5">
            <div>
                <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
                    {isTrialRequest ? t.contact_trial_title : t.contact_title}
                </h1>
                <p className="text-base leading-relaxed text-[var(--text-muted)]">
                    {isTrialRequest ? t.contact_trial_subtitle : t.contact_subtitle}
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <div className="flex gap-4 rounded-2xl border border-[var(--glass-sheet-border)] bg-[var(--glass-sheet-bg)] p-5 shadow-[var(--surface-card-shadow)] backdrop-blur-xl">
                    <div className="h-fit rounded-xl bg-accent/15 p-3 text-accent">
                        <Mail className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Email
                        </h3>
                        <a
                            href={`mailto:${t.contact_support_email}`}
                            className="mt-1 block font-semibold text-accent hover:underline"
                        >
                            {t.contact_support_email}
                        </a>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t.contact_email_channel}</p>
                    </div>
                </div>

                <div className="flex gap-4 rounded-2xl border border-[var(--glass-sheet-border)] bg-[var(--glass-sheet-bg)] p-5 shadow-[var(--surface-card-shadow)] backdrop-blur-xl">
                    <div className="h-fit rounded-xl bg-accent/15 p-3 text-accent">
                        <Phone className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {t.contact_phone_label}
                        </h3>
                        <p className="mt-1 font-semibold text-[var(--text-main)]">
                            {supportPhone || t.contact_phone_pending}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t.contact_hours}</p>
                    </div>
                </div>

                <div className="flex gap-4 rounded-2xl border border-[var(--glass-sheet-border)] bg-[var(--glass-sheet-bg)] p-5 shadow-[var(--surface-card-shadow)] backdrop-blur-xl">
                    <div className="h-fit rounded-xl bg-accent/15 p-3 text-accent">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            {t.contact_location_label}
                        </h3>
                        <p className="mt-1 font-semibold text-[var(--text-main)]">
                            {t.contact_location_value}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
