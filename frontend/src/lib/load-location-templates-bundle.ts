import type { LocationTemplate, TemplateTask } from "../types/template.ts";

export type LocationTemplatesLoaders = {
    getHouseTemplates: (locationId: number) => Promise<LocationTemplate[]>;
    getGlobalTemplates: () => Promise<TemplateTask[]>;
};

export type LocationTemplatesBundle = {
    houseTemplates: LocationTemplate[];
    globalTemplates: TemplateTask[];
    houseTemplatesError: string | null;
    globalTemplatesError: string | null;
};

function errorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim()) return error.message;
    return fallback;
}

/**
 * Load location + global templates without failing the whole sheet when one call 500s.
 */
export async function loadLocationTemplatesBundle(
    locationId: number,
    loaders: LocationTemplatesLoaders,
): Promise<LocationTemplatesBundle> {
    const [houseResult, globalResult] = await Promise.allSettled([
        loaders.getHouseTemplates(locationId),
        loaders.getGlobalTemplates(),
    ]);

    return {
        houseTemplates:
            houseResult.status === "fulfilled" ? houseResult.value : [],
        globalTemplates:
            globalResult.status === "fulfilled" ? globalResult.value : [],
        houseTemplatesError:
            houseResult.status === "rejected"
                ? errorMessage(houseResult.reason, "Error loading location templates")
                : null,
        globalTemplatesError:
            globalResult.status === "rejected"
                ? errorMessage(globalResult.reason, "Error loading templates")
                : null,
    };
}
