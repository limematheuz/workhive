"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useDictionary } from "@/lib/dictionary-context";
import { displayPlanCode, formatCompanyPlanLimit, formatCompanyPlanTrialEnd, visibleCompanyPlanEntitlements } from "@/lib/company-plan-summary";
import { CompanyPlanAccessService, type Entitlement } from "@/services/company-plan-access.service";
import { CompanyService, type Company } from "@/services/company.service";

type Snapshot = { company: Company; entitlements: Entitlement[] };

export function CompanyPlanSummary({ companyId }: { companyId: number }) {
    const { dict, locale } = useDictionary();
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [retry, setRetry] = useState(0);
    const [featuresOpen, setFeaturesOpen] = useState(false);

    useEffect(() => {
        let active = true;
        Promise.all([
            CompanyService.getCompany(companyId),
            CompanyPlanAccessService.getCurrentEntitlements(),
        ]).then(([company, access]) => {
            if (!active) return;
            setSnapshot({ company, entitlements: access.entitlements });
            setFailed(false);
        }).catch(() => {
            if (!active) return;
            setFailed(true);
        }).finally(() => {
            if (active) setLoading(false);
        });
        return () => { active = false; };
    }, [companyId, retry]);

    const copy = locale === "es" ? {
        title: "Tu empresa y plan",
        description: "Consulta las funciones y capacidades disponibles. Los cambios de plan los gestiona WorkHive.",
        loading: "Cargando el plan de tu empresa…",
        error: "No se pudo cargar el plan de tu empresa.",
        retry: "Reintentar",
        noPlan: "Sin plan disponible",
        custom: "Personalizado",
        status: { trialing: "En prueba", active: "Activo", inactive: "Inactivo", expired: "Caducado", canceled: "Cancelado" },
        trialEnd: "La prueba termina el {date}",
        limits: "Límites del plan",
        features: "Funciones incluidas ({count})",
        noFeatures: "No hay funciones disponibles en este momento.",
    } : {
        title: "Your company and plan",
        description: "See your available features and capacity. WorkHive manages plan changes.",
        loading: "Loading your company plan…",
        error: "We could not load your company plan.",
        retry: "Retry",
        noPlan: "No plan available",
        custom: "Custom",
        status: { trialing: "Trial", active: "Active", inactive: "Inactive", expired: "Expired", canceled: "Canceled" },
        trialEnd: "Trial ends on {date}",
        limits: "Plan limits",
        features: "Included features ({count})",
        noFeatures: "No features are available right now.",
    };
    const labelFor = (item: Entitlement) =>
        dict.subscription.entitlements[item.code as keyof typeof dict.subscription.entitlements] ?? item.label;
    const planCode = displayPlanCode(snapshot?.company.subscription_plan);
    const planName = planCode === "custom" ? copy.custom
        : planCode ? dict.subscription.plan_names[planCode] : copy.noPlan;
    const { features, limits } = visibleCompanyPlanEntitlements(snapshot?.entitlements ?? []);
    const status = snapshot?.company.subscription_status ?? "inactive";
    const statusLabel = copy.status[status as keyof typeof copy.status] ?? status;
    const trialEndLabel = formatCompanyPlanTrialEnd(snapshot?.company.trial_ends_at, locale);

    return (
        <section className="billing-surface rounded-[24px] p-5 md:p-6" aria-labelledby="company-plan-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 id="company-plan-title" className="text-base font-semibold">{copy.title}</h2>
                    <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{copy.description}</p>
                </div>
                {snapshot && <Badge variant="outline">{statusLabel}</Badge>}
            </div>

            {loading ? (
                <p className="mt-5 flex items-center gap-2 text-sm text-[var(--text-muted)]" role="status">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />{copy.loading}
                </p>
            ) : failed || !snapshot ? (
                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                    <p role="alert">{copy.error}</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => { setLoading(true); setRetry((value) => value + 1); }}>{copy.retry}</Button>
                </div>
            ) : (
                <div className="mt-5 space-y-5">
                    <div>
                        <p className="text-lg font-semibold">{snapshot.company.name} · {planName}</p>
                        {status === "trialing" && trialEndLabel && (
                            <p className="mt-1 text-xs text-[var(--text-muted)]">{copy.trialEnd.replace("{date}", trialEndLabel)}</p>
                        )}
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold">{copy.limits}</h3>
                        <dl className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {limits.map((item) => (
                                <div key={item.code} className="flex justify-between gap-3 rounded-lg border border-[var(--border-soft)] px-3 py-2 text-sm">
                                    <dt className="text-[var(--text-muted)]">{labelFor(item)}</dt>
                                    <dd className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{formatCompanyPlanLimit(item.code, item.value as number, locale)}</dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                    <Collapsible open={featuresOpen} onOpenChange={setFeaturesOpen}>
                        <CollapsibleTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="gap-2">
                                {copy.features.replace("{count}", String(features.length))}
                                <ChevronDown className={`size-4 transition-transform ${featuresOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-3">
                            {features.length ? (
                                <ul className="flex flex-wrap gap-2">
                                    {features.map((item) => <li key={item.code}><Badge variant="secondary">{labelFor(item)}</Badge></li>)}
                                </ul>
                            ) : <p className="text-sm text-[var(--text-muted)]">{copy.noFeatures}</p>}
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            )}
        </section>
    );
}
