import type { LocationTemplate, LocationTemplateSummary, TemplateTask } from "@/types/template";

type LocationTemplateOverrides = Partial<Pick<
    LocationTemplate | LocationTemplateSummary,
    "custom_name" | "custom_description" | "custom_price" | "custom_unit"
>>;

export type EffectiveLocationTemplate = {
    name: string;
    description: string | null;
    price: number | null;
    unit: string;
    pricingMode: "fixed" | "hourly";
};

export function getEffectiveLocationTemplate(
    assignment: LocationTemplateOverrides,
    template?: TemplateTask | LocationTemplate["template"],
): EffectiveLocationTemplate {
    return {
        name: assignment.custom_name?.trim() || template?.name || "",
        description: assignment.custom_description ?? template?.description ?? null,
        price: assignment.custom_price ?? template?.default_price ?? null,
        unit: assignment.custom_unit?.trim() || template?.unit || "unit",
        pricingMode: template?.pricing_mode === "hourly" ? "hourly" : "fixed",
    };
}
