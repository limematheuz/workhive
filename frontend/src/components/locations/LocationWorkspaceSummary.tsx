interface LocationWorkspaceSummaryProps {
    name: string;
    address: string;
    city: string;
    siteTypeLabel?: string;
    spacesCount: number | string;
    accessLabel: string;
}

export function LocationWorkspaceSummary({ name, address, city, siteTypeLabel, spacesCount, accessLabel }: LocationWorkspaceSummaryProps) {
    const { dict } = useDictionary();
    const workspace = dict.locations.workspace;
    return (
        <aside className="h-fit rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-primary)] p-4 shadow-sm xl:sticky xl:top-0">
            <h3 className="text-sm font-bold text-[var(--text-main)]">{workspace.summary}</h3>
            <dl className="mt-4 space-y-4 text-xs">
                <div className="flex items-start gap-2.5"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><Building2 className="h-3.5 w-3.5" /></span><div><dt className="text-[var(--text-muted)]">{workspace.name}</dt><dd className="mt-0.5 font-semibold text-[var(--text-main)]">{name || workspace.pending}</dd></div></div>
                <div className="flex items-start gap-2.5"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><MapPin className="h-3.5 w-3.5" /></span><div><dt className="text-[var(--text-muted)]">{workspace.address}</dt><dd className="mt-0.5 font-semibold text-[var(--text-main)]">{address || city ? `${address}${address && city ? ", " : ""}${city}` : workspace.pending}</dd></div></div>
                <div className="flex items-start gap-2.5"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><Tags className="h-3.5 w-3.5" /></span><div><dt className="text-[var(--text-muted)]">{workspace.type}</dt><dd className="mt-0.5 font-semibold text-[var(--text-main)]">{siteTypeLabel || workspace.other_type}</dd></div></div>
                <div className="flex items-start gap-2.5"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><Layers3 className="h-3.5 w-3.5" /></span><div><dt className="text-[var(--text-muted)]">{workspace.spaces}</dt><dd className="mt-0.5 font-semibold text-[var(--text-main)]">{spacesCount}</dd></div></div>
                <div className="flex items-start gap-2.5"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent"><KeyRound className="h-3.5 w-3.5" /></span><div><dt className="text-[var(--text-muted)]">{workspace.access}</dt><dd className="mt-0.5 font-semibold text-[var(--text-main)]">{accessLabel}</dd></div></div>
            </dl>
        </aside>
    );
}
import { Building2, KeyRound, Layers3, MapPin, Tags } from "lucide-react";
import { useDictionary } from "@/lib/dictionary-context";
