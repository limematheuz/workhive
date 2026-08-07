export const QUOTE_STATUS_BADGE: Record<string, string> = {
    draft: "border-[var(--alert-warning-border)] bg-[var(--alert-warning-bg)] text-[var(--alert-warning-text)]",
    sent: "border-[color-mix(in_srgb,var(--accent-color)_34%,transparent)] bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] text-accent",
    accepted: "border-[color-mix(in_srgb,var(--accent-color)_34%,transparent)] bg-[color-mix(in_srgb,var(--accent-color)_12%,transparent)] text-accent",
    rejected: "border-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_35%,transparent)] bg-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_8%,transparent)] text-[var(--btn-cancel-hover-bg)]",
    expired: "border-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_35%,transparent)] bg-[color-mix(in_srgb,var(--btn-cancel-hover-bg)_8%,transparent)] text-[var(--btn-cancel-hover-bg)]",
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
