"use client";

import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { Expense } from "@/types/expense";
import { useDictionary } from "@/lib/dictionary-context";

export function ExpenseCategoryBreakdown({ expenses, category, onCategoryChange }: { expenses: Expense[]; category: string; onCategoryChange: (value: string) => void }) {
    const { dict } = useDictionary();
    const labels: Record<string, string> = dict.expenses.categories;
    const categories = new Map<string, { amount: number; count: number }>();
    for (const expense of expenses) {
        const current = categories.get(expense.category) ?? { amount: 0, count: 0 };
        categories.set(expense.category, { amount: current.amount + expense.total_amount, count: current.count + 1 });
    }
    return <section className="billing-surface rounded-xl p-4"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Gasto por categoría</h2>{category && <Button variant="ghost" size="sm" onClick={() => onCategoryChange("")}>Todas las categorías</Button>}</div><p className="mt-1 text-xs text-muted-foreground">Importes con impuestos · pulsa una categoría para ver sus registros.</p><div className="mt-3 flex flex-wrap gap-2">{[...categories].sort((a, b) => b[1].amount - a[1].amount).map(([key, data]) => <Button type="button" key={key} variant="outline" className={`h-auto min-w-36 flex-col items-start gap-1 p-3 ${category === key ? "ring-2 ring-accent" : ""}`} onClick={() => onCategoryChange(key)}><span className="text-xs text-muted-foreground">{labels[key] || key || "Sin categoría registrada"}</span><strong className="tabular-nums">{formatCurrency(data.amount)}</strong><span className="text-xs text-muted-foreground">{data.count} registros</span></Button>)}</div>{expenses.length === 0 && <p className="mt-3 text-xs text-muted-foreground">Sin gastos para este periodo y búsqueda.</p>}</section>;
}
