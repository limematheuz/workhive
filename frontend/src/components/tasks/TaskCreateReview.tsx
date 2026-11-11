"use client";

import { useMemo } from "react";
import type { Dictionary } from "@/lib/dictionary-context";
import { useDictionary } from "@/lib/dictionary-context";
import { getEffectiveLocationTemplate } from "@/domain/locations/location-template";
import { resolveTaskCreationPricing, type TaskCreationPricingOverride } from "@/lib/task-pricing";
import type { HouseTemplate, TemplateTask } from "@/hooks/useTasksPage";
import type { Location, LocationZone } from "@/services/location.service";
import type { User } from "@/types/user";
import type { Reservation } from "@/types/reservation";
import { ALL_WORKERS_VALUE } from "./taskCreateChecklist";

type Props = {
    dict: Dictionary;
    location?: Location;
    date: string;
    template?: TemplateTask;
    houseTemplate?: HouseTemplate;
    pricingOverride?: TaskCreationPricingOverride;
    users: User[];
    assigneeId: string;
    zones: LocationZone[];
    selectedZoneIds: number[];
    checkoutReservation?: Reservation;
    nextReservation?: Reservation;
};

export function TaskCreateReview({ dict, location, date, template, houseTemplate, pricingOverride, users, assigneeId, zones, selectedZoneIds, checkoutReservation, nextReservation }: Props) {
    const { locale } = useDictionary();
    const text = dict.tasks.create_dialog;
    const dates = useMemo(() => {
        const format = (raw: string, withTime = false) => {
            const value = new Date(/^\d{4}-\d{2}-\d{2}$/.test(raw) ? `${raw}T12:00:00.000Z` : raw);
            return Number.isNaN(value.getTime()) ? raw : value.toLocaleString(locale === "es" ? "es-ES" : "en-GB", { dateStyle: "long", ...(withTime ? { timeStyle: "short" as const } : {}), timeZone: "UTC" });
        };
        return { planning: format(checkoutReservation?.check_out_at || date, Boolean(checkoutReservation)), checkout: checkoutReservation ? format(checkoutReservation.check_out_at, true) : text.no_checkout_reservation, next: nextReservation ? format(nextReservation.check_in_at, true) : text.no_next_reservation };
    }, [date, locale, checkoutReservation, nextReservation, text.no_checkout_reservation, text.no_next_reservation]);
    const effective = houseTemplate && template ? getEffectiveLocationTemplate(houseTemplate, template) : null;
    const pricing = effective ? resolveTaskCreationPricing(effective, pricingOverride) : null;
    const worker = users.find(user => String(user.id) === assigneeId);
    const team = assigneeId === ALL_WORKERS_VALUE ? text.wizard_all_workers : worker?.full_name || worker?.email || text.wizard_unassigned;
    const zoneIds = new Set(selectedZoneIds);
    const zoneNames = zones.flatMap(zone => zoneIds.has(zone.id) ? [zone.name] : []);
    const rows = [
        [text.select_location, location?.name || "—"],
        [text.date, dates.planning],
        [text.wizard_spaces, selectedZoneIds.length ? zoneNames.join(", ") : text.wizard_all_spaces],
        [text.wizard_service, effective?.name || "—"],
        [text.wizard_team, team],
        [text.wizard_price, pricing?.price == null ? text.wizard_pending_price : `${pricing.price} € / ${pricing.pricingMode === "hourly" ? text.hour : pricing.unit}`],
        [text.checkout_reservation, dates.checkout],
        [text.next_reservation, dates.next],
    ];
    return <section className="space-y-4">
        <div><h3 className="text-base font-bold text-[var(--text-main)]">{text.wizard_review}</h3><p className="mt-1 text-sm text-[var(--text-muted)]">{text.wizard_review_hint}</p></div>
        <dl className="divide-y divide-[var(--border-soft)] rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] px-4">
            {rows.map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4"><dt className="text-xs font-medium text-[var(--text-muted)]">{label}</dt><dd className="break-words text-sm font-semibold text-[var(--text-main)]">{value}</dd></div>)}
        </dl>
        <p className="text-xs text-[var(--text-muted)]">{text.wizard_assignment_hint}</p>
    </section>;
}
