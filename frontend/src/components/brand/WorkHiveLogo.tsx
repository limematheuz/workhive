import { preload } from "react-dom";
import { cn } from "@/lib/utils";

type WorkHiveLogoProps = {
    className?: string;
    compact?: boolean;
    priority?: boolean;
};

/** The supplied vector artwork has separate variants for both themes. */
export function WorkHiveLogo({ className, compact = false, priority = false }: WorkHiveLogoProps) {
    const format = compact ? "isotipo" : "horizontal";
    const light = `/logo/workhive-${format}-color-fondo-claro.svg`;
    const dark = `/logo/workhive-${format}-color-fondo-oscuro.svg`;
    if (priority) preload(light, { as: "image" });
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={compact ? "0 0 256 256" : "0 0 1086 248"}
            role="img"
            aria-label="WorkHive"
            className={cn("block h-auto shrink-0", className)}
        >
            <image className="brand-art-light" href={light} width={compact ? 256 : 1086} height={compact ? 256 : 248} aria-hidden="true" />
            <image className="brand-art-dark" href={dark} width={compact ? 256 : 1086} height={compact ? 256 : 248} aria-hidden="true" />
        </svg>
    );
}
