interface LocationWorkspaceSummaryProps {
    name: string;
    address: string;
    city: string;
    siteTypeLabel?: string;
    spacesCount: number | string;
    accessLabel: string;
}

export function LocationWorkspaceSummary({ name, address, city, siteTypeLabel, spacesCount, accessLabel }: LocationWorkspaceSummaryProps) {
    return (
        <aside className="h-fit rounded-2xl border border-[var(--border-soft)] bg-[var(--bg-secondary)] p-4">
            <h3 className="text-sm font-bold text-[var(--text-main)]">Resumen de la ubicación</h3>
            <dl className="mt-4 space-y-3 text-xs">
                <div><dt className="text-[var(--text-muted)]">Nombre</dt><dd className="mt-0.5 font-semibold text-[var(--text-main)]">{name || "Pendiente"}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Dirección</dt><dd className="mt-0.5 font-semibold text-[var(--text-main)]">{address || city ? `${address}${address && city ? ", " : ""}${city}` : "Pendiente"}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Tipo</dt><dd className="mt-0.5 font-semibold text-[var(--text-main)]">{siteTypeLabel || "Otro"}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Espacios</dt><dd className="mt-0.5 font-semibold text-[var(--text-main)]">{spacesCount}</dd></div>
                <div><dt className="text-[var(--text-muted)]">Acceso</dt><dd className="mt-0.5 font-semibold text-[var(--text-main)]">{accessLabel}</dd></div>
            </dl>
        </aside>
    );
}
