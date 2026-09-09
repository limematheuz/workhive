import type { LocationAccessProfile, LocationContact, LocationProfile, LocationRisk, LocationServiceWindow, LocationSpace } from "@/types/location";

export type OperatingModel = "service_provider" | "property_manager" | "hybrid";

export type OnboardingLocationType =
    | "private"
    | "real_estate"
    | "business"
    | "exterior"
    | "other";

export interface OnboardingLocationFields {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    locationType: OnboardingLocationType;
}

export interface CompanyOnboardingInput {
    operating_model: OperatingModel;
    location?: {
        name: string;
        address: string;
        city: string;
        postal_code: string;
        location_type: OnboardingLocationType;
        profile?: Omit<LocationProfile, "location_id" | "attributes"> & { attributes?: LocationProfile["attributes"] };
        access?: Omit<LocationAccessProfile, "location_id" | "has_access_code"> & { access_code?: string; clear_access_code?: boolean };
        spaces?: Omit<LocationSpace, "id" | "location_id" | "sort_order" | "is_active">[];
        contacts?: Omit<LocationContact, "location_id" | "draft_id">[];
        risks?: Omit<LocationRisk, "location_id" | "draft_id">[];
        service_windows?: Omit<LocationServiceWindow, "location_id" | "draft_id">[];
    };
}

interface OnboardingUser {
    company_id?: number | null;
    role?: { name?: string | null } | null;
}

const DEFAULT_LOCATION_TYPES: Record<OperatingModel, OnboardingLocationType> = {
    service_provider: "private",
    property_manager: "real_estate",
    hybrid: "real_estate",
};

export function defaultLocationTypeForModel(
    operatingModel: OperatingModel,
): OnboardingLocationType {
    return DEFAULT_LOCATION_TYPES[operatingModel];
}

/**
 * The operating model is a company preference, not an authorization role.
 * The profile only gives the canonical location workspace a sensible starting
 * point; administrators can refine it in the normal location editor.
 */
export function defaultLocationProfileForModel(
    operatingModel: OperatingModel,
): { site_type: string } {
    return operatingModel === "service_provider"
        ? { site_type: "other" }
        : { site_type: "tourist_apartment" };
}

export function shouldShowCompanyOnboarding(
    user: OnboardingUser,
): user is OnboardingUser & {
    company_id: number;
    role: { name: "admin" };
} {
    return Boolean(user.company_id && user.role?.name === "admin");
}

export function isOnboardingLocationComplete(
    fields: OnboardingLocationFields,
): boolean {
    return [fields.name, fields.address, fields.city, fields.postalCode].every(
        (value) => value.trim().length > 0,
    );
}

export function buildCompanyOnboardingInput(
    operatingModel: OperatingModel,
    fields?: OnboardingLocationFields,
): CompanyOnboardingInput {
    if (!fields) return { operating_model: operatingModel };

    return {
        operating_model: operatingModel,
        location: {
            name: fields.name.trim(),
            address: fields.address.trim(),
            city: fields.city.trim(),
            postal_code: fields.postalCode.trim(),
            location_type: fields.locationType,
            profile: defaultLocationProfileForModel(operatingModel),
        },
    };
}
