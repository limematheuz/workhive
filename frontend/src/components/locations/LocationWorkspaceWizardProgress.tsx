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
        <ol className="grid grid-cols-4 border-y border-[var(--border-soft)] bg-[var(--bg-primary)] px-2 py-3 sm:px-5" aria-label="Progreso de la ubicación">
            {WIZARD_STEPS.map((label, index) => {
                const itemStep = index + 1;
                const complete = itemStep < step;
                const active = itemStep === step;
                return (
                    <li key={label} className="relative flex min-w-0 flex-col items-center text-center sm:flex-row sm:text-left">
                        {index > 0 && <span className="absolute right-1/2 top-3 hidden h-px w-full -translate-y-1/2 bg-[var(--border-soft)] sm:block" />}
                        <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${complete || active ? "border-accent bg-accent text-white" : "border-[var(--border-soft)] bg-[var(--bg-primary)] text-[var(--text-muted)]"}`}>
                            {complete ? <Check className="h-3.5 w-3.5" /> : itemStep}
                        </span>
                        <span className={`relative z-10 mt-1 min-w-0 bg-[var(--bg-primary)] px-1 text-[10px] font-semibold leading-tight sm:mt-0 sm:ml-2 sm:text-xs ${active ? "text-accent" : "text-[var(--text-muted)]"}`}>{label}</span>
                    </li>
                );
            })}
        </ol>
    );
}
