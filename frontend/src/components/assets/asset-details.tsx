import { Badge } from "@/components/ui/badge";
import { formatSpanishDate, parseIsoDate } from "@/lib/date-picker-utils";
import { assetStatusLabel } from "@/lib/asset-presentation";
import type { LocationEquipmentLibraryItem, LocationEquipmentStatus } from "@/types/location";

export function AssetStatus({ status }: { status: LocationEquipmentStatus }) {
    return <Badge variant={status === "retired" ? "secondary" : "outline"}>{assetStatusLabel[status]}</Badge>;
}

export function AssetServiceDate({ value }: { value?: string | null }) {
    const label = formatSpanishDate(parseIsoDate(value ?? undefined));
    return label ? <time dateTime={value ?? undefined}>{label}</time> : <>—</>;
}

export function AssetCompactDetails({ asset }: { asset: LocationEquipmentLibraryItem }) {
    return <div className="min-w-0 space-y-1 text-sm">
        <p className="break-words font-semibold text-[var(--text-main)]">{asset.name}</p>
        <p className="break-words text-xs text-[var(--text-muted)]">{asset.location_name}</p>
        <p className="break-words text-xs text-[var(--text-muted)]">{asset.category} · {asset.quantity} ud.</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <AssetStatus status={asset.status} />
            <span className="text-xs text-[var(--text-muted)]">Próximo mantenimiento: <AssetServiceDate value={asset.next_service_at} /></span>
        </div>
    </div>;
}
