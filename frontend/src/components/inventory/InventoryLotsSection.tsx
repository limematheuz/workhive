"use client";

import { Boxes } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { DataListTable, type DataListColumn } from "@/components/ui/data-list-table";
import type { InventoryLot } from "@/types/inventory";


type InventoryLotsSectionProps = {
    lots: InventoryLot[];
    loading: boolean;
};

const columns: DataListColumn[] = [
    { key: "lot", label: "Lote", className: "w-[19%]" },
    { key: "material", label: "Material", className: "w-[26%]" },
    { key: "warehouse", label: "Almacén", className: "w-[22%]" },
    { key: "expiry", label: "Caducidad", className: "w-[16%]" },
    { key: "available", label: "Disponible", className: "w-[17%] text-right" },
];

const quantityFormatter = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 });
const dateFormatter = new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeZone: "Europe/Madrid" });

function quantity(value: string) {
    return quantityFormatter.format(Number(value));
}

function date(value: string | null) {
    return value ? dateFormatter.format(new Date(`${value}T12:00:00`)) : "Sin caducidad";
}

function LotExpiry({ lot }: { lot: InventoryLot }) {
    return <div className="flex flex-wrap items-center gap-1.5"><span>{date(lot.expires_at)}</span>
        {lot.expiry_status === "expired" && <Badge variant="destructive" title="Uso bloqueado en salidas y consumos">Caducado</Badge>}
        {lot.expiry_status === "expiring" && <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" title="Caduca en 30 días o menos">Caduca pronto</Badge>}
    </div>;
}

export function InventoryLotsSection({ lots, loading }: InventoryLotsSectionProps) {
    return <DataListTable
        items={lots}
        getRowKey={(lot) => lot.id}
        columns={columns}
        loading={loading}
        header={{ title: "Lotes", subtitle: "Aviso 30 días antes de caducar. Los lotes caducados sólo admiten devoluciones, correcciones o bajas con motivo.", countLabel: `${lots.length} lotes` }}
        empty={<div className="py-3 text-center"><Boxes className="mx-auto mb-2 size-7 text-[var(--text-muted)]" /><p className="text-sm text-[var(--text-muted)]">Añade un código de lote al registrar una compra para obtener trazabilidad.</p></div>}
        renderDesktopRow={(lot) => [
            <span key="lot" className="font-mono text-sm font-semibold text-[var(--text-main)]">{lot.code}</span>,
            <div key="material" className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{lot.material_name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{lot.material_sku}</p></div>,
            <span key="warehouse" className="truncate text-sm text-[var(--text-main)]">{lot.warehouse_name}</span>,
            <div key="expiry" className="text-sm text-[var(--text-muted)]"><LotExpiry lot={lot} /></div>,
            <span key="available" className="block text-right text-sm font-semibold text-[var(--text-main)]">{quantity(lot.available_quantity)}</span>,
        ]}
        renderCompactRow={(lot) => <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-mono text-sm font-semibold text-[var(--text-main)]">{lot.code}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{lot.material_name} · {lot.warehouse_name}</p><div className="mt-1 text-xs text-[var(--text-muted)]"><LotExpiry lot={lot} /></div></div><span className="shrink-0 text-sm font-semibold text-[var(--text-main)]">{quantity(lot.available_quantity)}</span></div>}
    />;
}
