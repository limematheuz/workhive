import type { Dictionary } from "./dictionary-context";
import type { PermissionDefinition } from "../services/organization.service";

export function permissionLabel(
    code: string,
    definition: PermissionDefinition | undefined,
    copy: Dictionary["organization"],
) {
    const labels = copy.profiles.permission_catalog as Record<string, string>;
    return labels[code] || (definition?.description !== code ? definition?.description : undefined) || labels.unknown;
}
