import type { Location } from "./location";

export type QualityTab = "templates" | "inspections" | "incidents" | "complaints";
export type QualityLocationOption = Pick<Location, "id" | "name"> & { client_id?: number | null };
export type QualitySectionAccess = {
    can_read: boolean;
    can_manage: boolean;
    read_locations: number[] | null;
    manage_locations: number[] | null;
};
export type QualityWorkspaceAccess = {
    sections: Record<QualityTab, QualitySectionAccess>;
    can_read_locations: boolean;
};
