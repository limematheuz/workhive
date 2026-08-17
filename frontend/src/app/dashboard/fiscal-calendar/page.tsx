"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ExternalLink, Info, Loader2, Settings2 } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { canAdministerCompany, isPlatformSuperadmin } from "@/domain/access/roles";
import { useDictionary } from "@/lib/dictionary-context";
import {
    buildQuarterlyFiscalDeadlines,
    getFiscalDeadlineStatus,
    type FiscalDeadline,
} from "@/lib/fiscal-calendar";
import { toast } from "@/lib/toast";
import { useUser } from "@/lib/user-context";
import {
    FiscalSettingsService,
    type CompanyFiscalSettings,
} from "@/services/fiscal-settings.service";

const AEAT_CALENDAR_URL = "https://sede.agenciatributaria.gob.es/Sede/ayuda/calendario-contribuyente.html";

function toCalendarPreferences(settings: CompanyFiscalSettings) {
    return {
        quarterlyVatEnabled: settings.quarterly_vat_enabled,
        quarterlyWithholdingEnabled: settings.quarterly_withholding_enabled,
        reminderDays: settings.fiscal_reminder_days,
    };
}

function formatDeadlineDate(value: string, locale: "en" | "es") {
    return new Date(`${value}T12:00:00`).toLocaleDateString(
        locale === "en" ? "en-US" : "es-ES",
        {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
        },
    );
}

export default function FiscalCalendarPage() {
    const { dict, locale } = useDictionary();
    const text = dict.fiscal_calendar;
    const { user, loading: userLoading } = useUser();
    const canManage = canAdministerCompany(user) && !isPlatformSuperadmin(user);
    const [settings, setSettings] = useState<CompanyFiscalSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [reminderDays, setReminderDays] = useState("7");

    useEffect(() => {
        if (userLoading || !canManage) return;

        let cancelled = false;

        const requestSettings = async () => {
            try {
                const loaded = await FiscalSettingsService.getSettings();
                if (cancelled) return;
                setSettings(loaded);
                setReminderDays(String(loaded.fiscal_reminder_days));
            } catch {
                if (!cancelled) toast.error(text.error_load);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void requestSettings();
        return () => {
            cancelled = true;
        };
    }, [canManage, text.error_load, userLoading]);

    const deadlines = useMemo(
        () => settings
            ? buildQuarterlyFiscalDeadlines(new Date().getFullYear(), toCalendarPreferences(settings))
            : [],
        [settings],
    );

    const updatePreference = (key: "quarterly_vat_enabled" | "quarterly_withholding_enabled", value: boolean) => {
        setSettings((current) => current ? { ...current, [key]: value } : current);
    };

    const save = async () => {
        if (!settings) return;
        const parsedReminderDays = Number(reminderDays);
        if (!Number.isInteger(parsedReminderDays) || parsedReminderDays < 1 || parsedReminderDays > 30) {
            toast.error(text.invalid_reminder);
            return;
        }

        try {
            setSaving(true);
            const updated = await FiscalSettingsService.updateSettings({
                quarterly_vat_enabled: settings.quarterly_vat_enabled,
                quarterly_withholding_enabled: settings.quarterly_withholding_enabled,
                fiscal_reminder_days: parsedReminderDays,
            });
            setSettings(updated);
            setReminderDays(String(updated.fiscal_reminder_days));
            toast.success(text.saved);
        } catch {
            toast.error(text.error_save);
        } finally {
            setSaving(false);
        }
    };

    if (userLoading || (loading && canManage)) {
        return (
            <div className="flex h-full items-center justify-center gap-3 text-[var(--text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin text-accent" />
                <span className="text-sm font-semibold">{text.title}</span>
            </div>
        );
    }

    if (!canManage) {
        return (
            <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-card-solid)] p-6">
                <p className="text-lg font-black text-[var(--text-main)]">{text.restricted_title}</p>
                <p className="mt-2 text-sm text-[var(--text-muted)]">{text.restricted_description}</p>
            </div>
        );
    }

    return (
        <div className="min-h-full px-3 py-3 sm:px-5 lg:px-6">
            <div className="mx-auto flex w-full max-w-[112rem] flex-col gap-4">
                <PageHeader
                    icon={CalendarDays}
                    title={text.title}
                    subtitle={text.subtitle}
                />

                <section className="billing-surface rounded-[24px] p-4 sm:p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 text-[var(--text-main)]">
                                <Settings2 className="h-4 w-4 text-accent" />
                                <h2 className="text-base font-bold">{text.settings_title}</h2>
                            </div>
                            <p className="mt-1 max-w-3xl text-sm text-[var(--text-muted)]">{text.settings_description}</p>
                        </div>
                        <Button type="button" size="sm" onClick={save} disabled={saving}>
                            {saving ? text.saving : text.save}
                        </Button>
                    </div>

                    <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_13rem]">
                        <PreferenceToggle
                            id="quarterly-vat"
                            checked={Boolean(settings?.quarterly_vat_enabled)}
                            label={text.vat_label}
                            onCheckedChange={(checked) => updatePreference("quarterly_vat_enabled", checked)}
                        />
                        <PreferenceToggle
                            id="quarterly-withholding"
                            checked={Boolean(settings?.quarterly_withholding_enabled)}
                            label={text.withholding_label}
                            onCheckedChange={(checked) => updatePreference("quarterly_withholding_enabled", checked)}
                        />
                        <label className="rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3.5 py-3">
                            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">
                                {text.reminder_label}
                            </span>
                            <span className="mt-1.5 flex items-center gap-2">
                                <input
                                    aria-label={text.reminder_label}
                                    className="w-12 bg-transparent text-center text-base font-bold text-[var(--text-main)] outline-none"
                                    inputMode="numeric"
                                    maxLength={2}
                                    value={reminderDays}
                                    onChange={(event) => setReminderDays(event.target.value.replace(/\D/g, ""))}
                                />
                                <span className="text-sm text-[var(--text-muted)]">{text.reminder_suffix}</span>
                            </span>
                        </label>
                    </div>
                </section>

                {deadlines.length ? (
                    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {deadlines.map((deadline) => (
                            <DeadlineCard
                                key={deadline.id}
                                deadline={deadline}
                                locale={locale}
                                text={text}
                            />
                        ))}
                    </section>
                ) : (
                    <section className="billing-surface flex min-h-48 flex-col items-center justify-center rounded-[24px] p-6 text-center">
                        <CalendarDays className="h-7 w-7 text-accent" />
                        <h2 className="mt-3 text-base font-bold text-[var(--text-main)]">{text.empty_title}</h2>
                        <p className="mt-1 max-w-md text-sm text-[var(--text-muted)]">{text.empty_description}</p>
                    </section>
                )}

                <aside className="flex flex-col gap-3 rounded-[20px] border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-4 py-3 text-sm text-[var(--text-muted)] sm:flex-row sm:items-center sm:justify-between">
                    <span className="flex items-start gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />{text.official_notice}</span>
                    <a
                        className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-accent hover:underline"
                        href={AEAT_CALENDAR_URL}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {text.official_link}<ExternalLink className="h-3.5 w-3.5" />
                    </a>
                </aside>
            </div>
        </div>
    );
}

function PreferenceToggle({
    id,
    checked,
    label,
    onCheckedChange,
}: {
    id: string;
    checked: boolean;
    label: string;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-tertiary)] px-3.5 py-3">
            <Checkbox id={id} checked={checked} onCheckedChange={(value) => onCheckedChange(value === true)} />
            <Label htmlFor={id} className="cursor-pointer text-sm font-semibold text-[var(--text-main)]">{label}</Label>
        </div>
    );
}

function DeadlineCard({
    deadline,
    locale,
    text,
}: {
    deadline: FiscalDeadline;
    locale: "en" | "es";
    text: Record<string, string>;
}) {
    const status = getFiscalDeadlineStatus(deadline);
    const statusLabel = text[`status_${status}`];
    const modelLabel = deadline.model === "303" ? text.model_303 : text.model_111;

    return (
        <article className="billing-surface rounded-[22px] p-4">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{deadline.model}</p>
                    <h2 className="mt-1 text-base font-bold text-[var(--text-main)]">{modelLabel}</h2>
                </div>
                <span className="rounded-full border border-[var(--brand-blue-border)] bg-[var(--brand-blue-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-accent">
                    {statusLabel}
                </span>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--text-muted)]">{text.period}</dt>
                    <dd className="font-semibold text-[var(--text-main)]">{deadline.periodLabel}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                    <dt className="text-[var(--text-muted)]">{text.deadline}</dt>
                    <dd className="font-semibold text-[var(--text-main)]">{formatDeadlineDate(deadline.dueDate, locale)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-[var(--border-soft)] pt-3">
                    <dt className="text-[var(--text-muted)]">{text.reminder}</dt>
                    <dd className="font-semibold text-[var(--text-main)]">{formatDeadlineDate(deadline.reminderDate, locale)}</dd>
                </div>
            </dl>
        </article>
    );
}
