"use client";

import type { ComponentProps } from "react";

import { TechTaskIssuesSection } from "./TechTaskIssuesSection";
import { TechTaskPropertySection } from "./TechTaskPropertySection";

type TechTaskPropertyPanelsProps = {
    locale: string;
    issuesProps: ComponentProps<typeof TechTaskIssuesSection>;
    propertyProps: ComponentProps<typeof TechTaskPropertySection>;
};

export function TechTaskPropertyPanels({
    locale,
    issuesProps,
    propertyProps,
}: TechTaskPropertyPanelsProps) {
    return (
        <div className="space-y-2">
            <h3 className="px-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                {locale === "es" ? "Propiedad" : "Property"}
            </h3>
            <div className="space-y-2">
                <TechTaskIssuesSection {...issuesProps} />
                <TechTaskPropertySection {...propertyProps} />
            </div>
        </div>
    );
}
