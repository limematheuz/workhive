import type { QualityWorkspaceAccess } from "../../src/types/quality-access";

export function qualityAccessFixture(capabilities: Record<string, boolean>): QualityWorkspaceAccess {
    return { sections: Object.fromEntries(["templates", "inspections", "incidents", "complaints"].map(section => {
        const read = capabilities[`quality.${section}.read`] === true;
        const manage = read && capabilities[`quality.${section}.manage`] === true;
        return [section, { can_read: read, can_manage: manage, read_locations: read ? null : [], manage_locations: manage ? null : [] }];
    })) as QualityWorkspaceAccess["sections"], can_read_locations: capabilities["locations.read"] === true };
}
