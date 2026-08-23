import { Check } from "lucide-react";

interface LocationWorkspaceWizardProgressProps {
    step: number;
}

const WIZARD_STEPS = [
    "Información y acceso",
    "Tipo de ubicación",
    "Características",
    "Espacios y tareas",
];

export function LocationWorkspaceWizardProgress({ step }: LocationWorkspaceWizardProgressProps) {
    return (
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Progreso de la ubicación">
            {WIZARD_STEPS.map((label, index) => {
                const itemStep = index + 1;
                const complete = itemStep < step;
                const active = itemStep === step;
                return (
                    <li key={label} className="flex min-w-0 items-center gap-2">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${complete || active ? "bg-accent text-white" : "bg-[var(--bg-tertiary)] text-[var(--text-muted)]"}`}>
                            {complete ? <Check className="h-3.5 w-3.5" /> : itemStep}
                        </span>
                        <span className={`min-w-0 text-xs font-semibold ${active ? "text-accent" : "text-[var(--text-muted)]"}`}>{label}</span>
                    </li>
                );
            })}
        </ol>
    );
}
