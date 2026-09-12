"use client";

import { Boxes } from "lucide-react";

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

function quantity(value: string) {
    return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(Number(value));
}

function date(value: string | null) {
    return value ? new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(new Date(`${value}T12:00:00`)) : "Sin caducidad";
}

export function InventoryLotsSection({ lots, loading }: InventoryLotsSectionProps) {
    return <DataListTable
        items={lots}
        getRowKey={(lot) => lot.id}
        columns={columns}
        loading={loading}
        header={{ title: "Lotes", subtitle: "Los lotes se crean al recibir una compra y conservan su saldo por almacén.", countLabel: `${lots.length} lotes` }}
        empty={<div className="py-3 text-center"><Boxes className="mx-auto mb-2 size-7 text-[var(--text-muted)]" /><p className="text-sm text-[var(--text-muted)]">Añade un código de lote al registrar una compra para obtener trazabilidad.</p></div>}
        renderDesktopRow={(lot) => [
            <span key="lot" className="font-mono text-sm font-semibold text-[var(--text-main)]">{lot.code}</span>,
            <div key="material" className="min-w-0"><p className="truncate font-semibold text-[var(--text-main)]">{lot.material_name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{lot.material_sku}</p></div>,
            <span key="warehouse" className="truncate text-sm text-[var(--text-main)]">{lot.warehouse_name}</span>,
            <span key="expiry" className="text-sm text-[var(--text-muted)]">{date(lot.expires_at)}</span>,
            <span key="available" className="block text-right text-sm font-semibold text-[var(--text-main)]">{quantity(lot.available_quantity)}</span>,
        ]}
        renderCompactRow={(lot) => <div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="truncate font-mono text-sm font-semibold text-[var(--text-main)]">{lot.code}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{lot.material_name} · {lot.warehouse_name}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{date(lot.expires_at)}</p></div><span className="shrink-0 text-sm font-semibold text-[var(--text-main)]">{quantity(lot.available_quantity)}</span></div>}
    />;
}
