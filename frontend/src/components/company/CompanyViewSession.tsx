"use client";
import { Fragment, type ReactNode } from "react";
import { companyViewContext } from "@/lib/company-view-context";
import { useUser } from "@/lib/user-context";

// A different actor or company starts with fresh records, drafts and dialogs.
export function CompanyViewSession({ children }: { children: ReactNode }) {
    const { user } = useUser();
    return <Fragment key={companyViewContext(user)}>{children}</Fragment>;
}
