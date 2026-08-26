import { Suspense } from "react";
import { cookies } from "next/headers";

import AcceptCompanyInvitationClient from "./AcceptCompanyInvitationClient";

const INVITATION_TOKEN_COOKIE = "workhive_company_invitation_token";

export default async function AcceptCompanyInvitationPage() {
    const initialToken = (await cookies()).get(INVITATION_TOKEN_COOKIE)?.value ?? "";

    return (
        <Suspense fallback={<div className="min-h-dvh bg-[var(--bg-primary)]" />}>
            <AcceptCompanyInvitationClient initialToken={initialToken} />
        </Suspense>
    );
}
