import { ClipboardCheck, FileCheck2, FileText, MessageSquareWarning, ReceiptText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ClientPortalOverview } from "@/types/client-portal";

export function ClientPortalOverviewSummary({ overview, clientName }: { overview: ClientPortalOverview; clientName: string }) {
    const counts = [
        { label: "Presupuestos", count: overview.quotes.length, icon: FileText },
        { label: "Contratos", count: overview.contracts.length, icon: FileCheck2 },
        { label: "Facturas", count: overview.invoices.length, icon: ReceiptText },
        { label: "Inspecciones", count: overview.inspections.length, icon: ClipboardCheck },
        { label: "Reclamaciones", count: overview.complaints.length, icon: MessageSquareWarning },
    ];
    return <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {counts.map(({ label, count, icon: Icon }) => <Card key={label}><CardContent>
                <Icon className="mb-4 size-5 text-accent" />
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">{label}</p>
                <p className="mt-1 text-3xl font-bold">{count}</p>
            </CardContent></Card>)}
        </div>
        <Card><CardContent>
            <h2 className="font-semibold">Acceso documental y de calidad</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Solo ves los presupuestos enviados, contratos, facturas e inspecciones cerradas de {clientName}. Las reclamaciones y sus respuestas se comparten entre todas las personas con acceso autorizado al portal de este cliente. Las notas internas quedan reservadas al proveedor. Este portal no da acceso al espacio de trabajo ni a información de otros clientes.</p>
        </CardContent></Card>
    </section>;
}
