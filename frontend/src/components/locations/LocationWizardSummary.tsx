import { Building2, Clock3, Grid2X2, Layers3, ListChecks, PencilLine, Ruler, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SummaryMetricCard, SummaryMetricGrid } from "@/components/ui/summary-metric-card";
import { locationTaskEstimate, readLocationFloors } from "@/domain/locations/location-setup";
import type { LocationContact, LocationSpace } from "@/types/location";
import type { LocationAccessDraft, LocationProfileDraft } from "./location-workspace-types";
import { LocationAccessSummary } from "./LocationAccessSummary";
import { LocationSpaceBreakdown } from "./LocationSpaceBreakdown";

type Props = {
    name: string; address: string; city: string; clientName?: string;
    profile: LocationProfileDraft; access: LocationAccessDraft; spaces: LocationSpace[];
    contacts: LocationContact[]; typeLabel?: string; existing?: boolean; hasAccessCode?: boolean;
    featureLabels?: string[]; compact?: boolean; hideIdentity?: boolean;
    onEdit?: (step: "information" | "operations" | "spaces") => void;
};
const days: Record<string, string> = { mon: "L", tue: "M", wed: "X", thu: "J", fri: "V", sat: "S", sun: "D" };

export function LocationWizardSummary({ name, address, city, clientName, profile, access, spaces, contacts, typeLabel, compact, onEdit, existing, hasAccessCode, hideIdentity, featureLabels = [] }: Props) {
    const floors = readLocationFloors(profile);
    const estimate = locationTaskEstimate(spaces);
    const surface = floors.reduce((sum, floor) => sum + floor.surface, 0);
    const plannedSpaces = floors.reduce((sum, floor) => sum + Object.values(floor.counts).reduce((count, value) => count + value, 0), 0);
    const spaceCount = spaces.length || plannedSpaces;
    const principal = contacts.find(contact => contact.is_primary) || contacts[0];
    const time = !estimate.tasks ? "—" : estimate.unestimated && !estimate.minutes ? "Sin estimar" : `${estimate.minutes} min`;
    const hours = [access.permitted_days.map(day => days[day]).join(" · "), access.permitted_from || access.permitted_until ? `${access.permitted_from || "—"} – ${access.permitted_until || "—"}` : ""].filter(Boolean).join(" · ");
    const edit = (step: Parameters<NonNullable<Props["onEdit"]>>[0]) => onEdit ? <Button type="button" size="xs" variant="ghost" onClick={() => onEdit(step)}><PencilLine className="size-3" />Editar</Button> : null;
    const facts = <dl className="wh-facts wh-location-summary-facts"><div><dt>Cliente</dt><dd>{clientName || "Sin cliente vinculado"}</dd></div><div><dt>Código interno</dt><dd>{profile.internal_code || "Sin código"}</dd></div><div className="col-span-2 wh-location-address"><dt>Dirección</dt><dd>{[address, city].filter(Boolean).join(", ") || "Pendiente de completar"}</dd></div>{profile.attributes.zone && <div><dt>Zona / distrito</dt><dd>{String(profile.attributes.zone)}</dd></div>}{profile.site_reference && <div><dt>Referencia</dt><dd>{profile.site_reference}</dd></div>}</dl>;

    if (compact) return <section className="wh-panel wh-compact-location-summary space-y-4">
        <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Resumen de ubicación</h3>{edit("information")}</div>
        <div className="flex min-w-0 gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-blue-soft)] text-accent"><Building2 className="size-5" /></span><div className="min-w-0"><p className="break-words text-base font-semibold">{name.trim() || "Nueva ubicación"}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{typeLabel || "Tipo pendiente"}</p></div></div>
        {facts}
        <div className="wh-stat-row"><div><strong>{floors.length}</strong><span>plantas</span></div><div><strong>{spaceCount}</strong><span>{spaces.length ? "espacios" : "espacios previstos"}</span></div><div><strong>{surface || "—"}</strong><span>superficie · m²</span></div></div>
        {estimate.tasks > 0 && <div className="grid grid-cols-2 gap-3 border-b border-[var(--border-soft)] pb-4"><div><p className="text-xl font-semibold tabular-nums text-accent">{estimate.tasks}</p><p className="mt-1 text-xs text-[var(--text-muted)]">tareas habituales</p></div><div><p className="text-lg font-semibold text-accent">{time}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{estimate.unestimated ? `${estimate.unestimated} sin estimar` : "por servicio"}</p></div></div>}
        {(principal || hours || access.access_method) && <dl className="wh-facts">{principal && <div className="col-span-2"><dt>Contacto principal</dt><dd>{principal.full_name}<span className="mt-1 block text-xs text-[var(--text-muted)]">{principal.phone || principal.email}</span></dd></div>}{hours && <div className="col-span-2"><dt>Horario de acceso</dt><dd>{hours}</dd></div>}{access.access_method && <div><dt>Acceso</dt><dd>{access.access_method}</dd></div>}</dl>}
        <p className="text-xs leading-relaxed text-[var(--text-muted)]">Podrás revisar todos los espacios y sus tareas antes de guardar.</p>
    </section>;

    const stats = [
        { label: "Plantas", value: String(floors.length), icon: Layers3, description: "Estructura de la ubicación" },
        { label: "Espacios", value: String(spaceCount), icon: Grid2X2, description: spaces.length ? "Configurados" : "Según las características" },
        { label: "Tareas habituales", value: String(estimate.tasks), icon: ListChecks, description: "Asociadas a sus espacios" },
        { label: "Superficie", value: surface ? `${surface} m²` : "Sin indicar", icon: Ruler, description: "Total de las plantas" },
        { label: "Tiempo estimado", value: time, icon: Clock3, description: estimate.unestimated ? `${estimate.unestimated} tareas sin tiempo definido` : "Suma de todos los espacios" },
    ];
    return <div className="wh-location-summary space-y-3">
        <section className={hideIdentity ? "wh-panel" : "wh-summary-banner"}>
            {!hideIdentity && <div className="flex min-w-0 items-center gap-3"><span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-[var(--bg-primary)] text-accent"><Building2 className="size-6" /></span><div className="min-w-0"><h3 className="break-words text-xl font-semibold">{name.trim() || "Nueva ubicación"}</h3><p className="mt-1 text-sm text-[var(--text-muted)]">{typeLabel || "Tipo pendiente"}</p></div></div>}
            {facts}
        </section>
        <SummaryMetricGrid desktopColumns={5} aria-label="Resumen de la ubicación">{stats.map(stat => <SummaryMetricCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} description={stat.label === "Tiempo estimado" && estimate.unestimated ? stat.description : undefined} />)}</SummaryMetricGrid>
        <div className="wh-review-grid">
            <div className="space-y-4">
                <LocationAccessSummary access={access} hours={hours} hasAccessCode={hasAccessCode} action={edit("information")} />
                <details className="wh-panel wh-floor-summary"><summary className="cursor-pointer text-sm font-semibold">Plantas y espacios · {floors.length} {floors.length === 1 ? "planta" : "plantas"} · {spaceCount} {spaceCount === 1 ? "espacio" : "espacios"}</summary><div className="mt-3">{edit("operations")}<div className="grid gap-2 sm:grid-cols-2">{floors.map(floor => {
                    let count = 0;
                    for (const space of spaces) if (space.attributes?.floor === floor.name) count++;
                    if (!spaces.length) count = Object.values(floor.counts).reduce((sum, value) => sum + value, 0);
                    return <div key={floor.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] px-3 py-3"><div><h5 className="text-sm font-semibold">{floor.name}</h5><p className="mt-1 text-xs text-[var(--text-muted)]">{floor.surface ? `${floor.surface} m²` : "Superficie sin indicar"}</p></div><p className="text-right"><strong className="text-xl font-semibold tabular-nums text-accent">{count}</strong><span className="mt-1 block text-[11px] text-[var(--text-muted)]">espacios</span></p></div>;
                })}</div>{featureLabels.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{featureLabels.map(label => <span key={label} className="rounded-md bg-[var(--brand-blue-soft)] px-2.5 py-1.5 text-xs text-accent">✓ {label}</span>)}</div>}</div></details>
            </div>
            <aside className="wh-summary-side" aria-label="Información de contacto y observaciones">
                <section className="wh-panel"><div className="wh-summary-section-heading"><h4 className="wh-panel-title">Personas de contacto</h4>{edit("information")}</div>{contacts.length ? <div className="space-y-4">{contacts.map(contact => <div key={contact.id ?? contact.draft_id ?? `${contact.full_name}:${contact.phone || contact.email}`} className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-blue-soft)] text-accent"><UserRound className="size-4" /></span><div className="min-w-0"><p className="text-sm font-semibold">{contact.full_name}</p><p className="mt-1 text-[11px] text-[var(--text-muted)]">{contact.is_primary ? "Contacto principal" : "Contacto operativo"}</p>{contact.phone && <p className="mt-1 text-xs">{contact.phone}</p>}{contact.email && <p className="mt-1 break-all text-xs text-[var(--text-muted)]">{contact.email}</p>}</div></div>)}</div> : <p className="text-sm text-[var(--text-muted)]">Sin contactos operativos.</p>}</section>
                <details className="wh-panel"><summary className="cursor-pointer text-sm font-semibold">Observaciones{profile.service_notes ? "" : " · Sin observaciones"}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--text-muted)]">{profile.service_notes || "Sin observaciones"}</p></details>
            </aside>
        </div>
        <section className="wh-panel"><div className="wh-summary-section-heading"><div><h4 className="wh-panel-title">Espacios y sus tareas</h4><p className="mt-1 text-xs text-[var(--text-muted)]">Cantidad de tareas y tiempo por espacio; consulta el detalle al desplegar cada fila.</p></div>{edit("spaces")}</div>{existing && !spaces.length ? <p className="text-sm text-[var(--text-muted)]">La estructura existente se conserva y se gestiona desde la ficha de ubicación.</p> : <LocationSpaceBreakdown spaces={spaces} />}</section>
    </div>;
}
