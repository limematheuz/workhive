"use client";

import * as React from "react";

import { LocationMarginPanel } from "@/components/analytics/LocationMarginPanel";
import { MarginForecastPanel } from "@/components/margin-forecast/MarginForecastPanel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MarginForecastScopeType } from "@/types/margin-forecast";
import type { Location } from "@/types/location";
import type { ServiceContract } from "@/types/service-contract";
import type { WorkOrder } from "@/types/work-order";

type OperationalMarginExplorerProps = {
    contracts: ServiceContract[];
    workOrders: WorkOrder[];
    locations: Location[];
    loading: boolean;
    canManage: boolean;
    copy: Record<string, string>;
};

export function OperationalMarginExplorer({
    contracts,
    workOrders,
    locations,
    loading,
    canManage,
    copy,
}: OperationalMarginExplorerProps) {
    const [scopeType, setScopeType] = React.useState<MarginForecastScopeType | "location">("contract");
    const candidates = scopeType === "contract"
        ? contracts
        : scopeType === "work_order"
            ? workOrders
            : locations;
    const [scopeId, setScopeId] = React.useState<number | null>(null);
    const resolvedScopeId = scopeId !== null && candidates.some((candidate) => candidate.id === scopeId)
        ? scopeId
        : candidates[0]?.id ?? null;

    const changeScopeType = (value: string) => {
        const nextScopeType = value as MarginForecastScopeType | "location";
        const nextCandidates = nextScopeType === "contract"
            ? contracts
            : nextScopeType === "work_order"
                ? workOrders
                : locations;
        setScopeType(nextScopeType);
        setScopeId(nextCandidates[0]?.id ?? null);
    };

    const selectedScope = candidates.find((candidate) => candidate.id === resolvedScopeId) ?? null;

    return (
        <section className="billing-surface rounded-[28px] p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                    <h2 className="text-base font-semibold text-[var(--text-main)]">{copy.operational_margin_title}</h2>
                    <p className="mt-1 max-w-3xl text-xs leading-5 text-[var(--text-muted)]">{copy.operational_margin_subtitle}</p>
                </div>
                <div className="grid w-full gap-2 sm:w-[31rem] sm:grid-cols-2">
                    <Select value={scopeType} onValueChange={changeScopeType}>
                        <SelectTrigger aria-label={copy.operational_margin_scope}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="contract">{copy.operational_margin_contract}</SelectItem>
                            <SelectItem value="work_order">{copy.operational_margin_work_order}</SelectItem>
                            <SelectItem value="location">{copy.operational_margin_location}</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select
                        value={resolvedScopeId === null ? undefined : String(resolvedScopeId)}
                        onValueChange={(value) => setScopeId(Number(value))}
                        disabled={loading || candidates.length === 0}
                    >
                        <SelectTrigger aria-label={copy.operational_margin_select}>
                            <SelectValue placeholder={copy.operational_margin_select} />
                        </SelectTrigger>
                        <SelectContent>
                            {scopeType === "contract"
                                ? contracts.map((contract) => (
                                    <SelectItem key={contract.id} value={String(contract.id)}>
                                        {contract.contract_number} · {contract.title}
                                    </SelectItem>
                                ))
                                : scopeType === "work_order" ? workOrders.map((workOrder) => (
                                    <SelectItem key={workOrder.id} value={String(workOrder.id)}>
                                        {workOrder.title}
                                    </SelectItem>
                                )) : locations.map((location) => (
                                    <SelectItem key={location.id} value={String(location.id)}>
                                        {location.name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {loading ? (
                <p className="py-12 text-center text-sm text-[var(--text-muted)]">{copy.loading}</p>
            ) : selectedScope && resolvedScopeId !== null && scopeType === "location" ? (
                <LocationMarginPanel
                    key={`location-${resolvedScopeId}`}
                    locationId={resolvedScopeId}
                    copy={copy}
                />
            ) : selectedScope && resolvedScopeId !== null && (scopeType === "contract" || scopeType === "work_order") ? (
                <MarginForecastPanel
                    key={`${scopeType}-${resolvedScopeId}`}
                    scopeType={scopeType}
                    scopeId={resolvedScopeId}
                    canManage={canManage}
                    className="border-b-0"
                />
            ) : (
                <p className="py-12 text-center text-sm text-[var(--text-muted)]">{copy.operational_margin_empty}</p>
            )}
        </section>
    );
}
