import type {
    Location,
    LocationAccessProfile,
    LocationCatalog,
    LocationProfile,
    LocationProfileAttributeValue,
    LocationSpace,
} from "@/types/location";
import type { Client } from "@/services/client.service";
import type { OrganizationDepartment, OrganizationTeam } from "@/services/organization.service";

export type LocationWorkspacePayload = Pick<
    Location,
    "name" | "address" | "city" | "postal_code" | "client_id" | "location_type" | "department_id" | "team_id"
> & {
    profile?: Omit<LocationProfile, "location_id">;
    access?: Omit<LocationAccessProfile, "location_id" | "has_access_code"> & {
        access_code?: string;
        clear_access_code?: boolean;
    };
    spaces?: Omit<LocationSpace, "id" | "location_id" | "sort_order" | "is_active">[];
};

export type LocationProfileDraft = Omit<LocationProfile, "location_id">;

export type LocationAccessDraft = Omit<
    LocationAccessProfile,
    "location_id" | "has_access_code"
> & {
    access_code: string;
    clear_access_code: boolean;
};

export interface LocationInfoAccessStepProps {
    clients: Client[];
    showClientAssignment?: boolean;
    name: string;
    address: string;
    city: string;
    postalCode: string;
    clientId: string;
    departments: OrganizationDepartment[];
    teams: OrganizationTeam[];
    organizationAssignmentAvailable: boolean;
    departmentId: string;
    teamId: string;
    access: LocationAccessDraft;
    hasStoredAccessCode: boolean;
    setName: (value: string) => void;
    setAddress: (value: string) => void;
    setCity: (value: string) => void;
    setPostalCode: (value: string) => void;
    setClientId: (value: string) => void;
    setDepartmentId: (value: string) => void;
    setTeamId: (value: string) => void;
    setAccess: (value: LocationAccessDraft) => void;
}

export interface LocationTypeStepProps {
    catalog: LocationCatalog | null;
    loading: boolean;
    profile: LocationProfileDraft;
    setProfile: (value: LocationProfileDraft) => void;
}

export interface LocationFeaturesStepProps {
    profile: LocationProfileDraft;
    catalog: LocationCatalog | null;
    setProfile: (value: LocationProfileDraft) => void;
    setAttribute: (id: string, value: LocationProfileAttributeValue) => void;
}

export interface LocationSpacesStepProps {
    editingExistingLocation: boolean;
    profile: LocationProfileDraft;
    spaces: LocationSpace[];
    spaceName: string;
    spaceType: string;
    suggesting: boolean;
    setSpaceName: (value: string) => void;
    setSpaceType: (value: string) => void;
    removeSpace: (index: number) => void;
    addSpace: () => void;
    suggestSpaces: () => void;
}
