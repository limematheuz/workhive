import { preload } from "react-dom";
import { cn } from "@/lib/utils";

type WorkHiveLogoProps = {
    className?: string;
    compact?: boolean;
    priority?: boolean;
};

/** Keep the supplied artwork and align its visible shapes, excluding image margins. */
export function WorkHiveLogo({ className, compact = false, priority = false }: WorkHiveLogoProps) {
    if (priority) preload("/logo/workhive.png", { as: "image" });
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox={compact ? "0 0 121 116" : "0 0 583 116"}
            role="img"
            aria-label="WorkHive"
            className={cn("block h-auto shrink-0 rounded-[3px] bg-white", className)}
        >
            <svg data-brand-part="isotype" x="0" y="0" width="121" height="116" viewBox="12 11 121 116" overflow="hidden" aria-hidden="true">
                <image href="/logo/workhive.png" width="606" height="131" />
            </svg>
            {!compact && (
                <svg data-brand-part="wordmark" x="133" y="16" width="450" height="84" viewBox="145 6 450 84" overflow="hidden" aria-hidden="true">
                    <image href="/logo/workhive.png" width="606" height="131" />
                </svg>
            )}
        </svg>
    );
}
