"use client";

import { createContext, useContext } from "react";

export const OrganizationAccessContext = createContext<Record<string, boolean>>({});

export function useOrganizationPermission(code: string): boolean {
    return useContext(OrganizationAccessContext)[code] === true;
}
