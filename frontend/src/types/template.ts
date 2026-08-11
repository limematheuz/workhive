export interface TemplateTask {
    id: number;
    company_id: number;
    name: string;
    description?: string | null;
    default_price?: number | null;
    unit: string;
    pricing_mode?: "fixed" | "hourly";
    is_active: boolean;
}

export type LocationTemplateTask = Omit<TemplateTask, "is_active">;

export interface LocationTemplate {
    template_task_id: number;
    custom_price: number | null;
    custom_name?: string | null;
    custom_description?: string | null;
    custom_unit?: string | null;
    location_id: number;
    template: LocationTemplateTask;
}

export interface LocationTemplateSummary {
    template_task_id: number;
    custom_price: number | null;
    custom_name?: string | null;
    custom_description?: string | null;
    custom_unit?: string | null;
    location_id: number;
}
