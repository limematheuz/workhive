import { snapshotLineRows } from "@/lib/snapshot-line-rows";
import type { ClientPortalLine } from "@/types/client-portal";

const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

export function ClientPortalDocumentLines({ lines }: { lines: ClientPortalLine[] }) {
    if (!lines.length) return null;
    return <div className="mt-4 divide-y divide-[var(--border-soft)] border-t border-[var(--border-soft)]">{snapshotLineRows(lines).map(({line, key}) => <div key={key} className="flex items-start justify-between gap-4 py-3 text-sm"><div className="min-w-0"><p className="font-medium text-[var(--text-main)]">{line.description}</p><p className="mt-0.5 text-xs text-[var(--text-muted)]">{line.quantity} × {money.format(line.unit_price)}</p></div><span className="shrink-0 font-mono font-semibold text-[var(--text-main)]">{money.format(line.subtotal)}</span></div>)}</div>;
}
