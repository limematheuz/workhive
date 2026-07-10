export const QUOTE_STATUS_BADGE: Record<string, string> = {
    draft: "bg-accent/10 text-accent border border-accent/20",
    sent: "bg-amber-600/10 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-600/20 dark:border-amber-500/20",
    accepted: "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
    rejected: "bg-rose-500/10 text-rose-500 border border-rose-500/20",
    expired: "bg-neutral-500/10 text-neutral-500 border border-neutral-500/20",
}

export const TAX_RATE_OPTIONS = [
    { value: "0.21", label: "IVA 21%" },
    { value: "0.10", label: "IVA 10%" },
    { value: "0.04", label: "IVA 4%" },
    { value: "0", label: "No aplica (0%)" },
] as const

export const EQUIVALENCE_SURCHARGE_OPTIONS = [
    { value: "0", labelKey: "equivalence_surcharge_none", fallback: "No aplica" },
    { value: "5.2", label: "R.E. 5.2%" },
    { value: "1.4", label: "R.E. 1.4%" },
    { value: "0.5", label: "R.E. 0.5%" },
] as const

export const RETENTION_OPTIONS = [
    { value: "0", labelKey: "equivalence_surcharge_none", fallback: "No aplica" },
    { value: "15", label: "IRPF 15%" },
    { value: "19", label: "IRPF 19%" },
    { value: "7", label: "IRPF 7%" },
] as const
