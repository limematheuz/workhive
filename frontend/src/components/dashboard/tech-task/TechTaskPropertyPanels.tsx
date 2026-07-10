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
            <h3 className="text-xs font-black text-[var(--text-main)] uppercase tracking-wider">
                {locale === "es" ? "Propiedad" : "Property"}
            </h3>
            <TechTaskIssuesSection {...issuesProps} />
            <TechTaskPropertySection {...propertyProps} />
        </div>
    );
}
