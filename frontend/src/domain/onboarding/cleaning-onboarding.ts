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
        },
    };
}
