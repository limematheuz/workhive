import { Suspense } from "react";

import AcceptSponsoredPartnerInvitationClient from "./AcceptSponsoredPartnerInvitationClient";

export default function AcceptSponsoredPartnerInvitationPage() {
    return (
        <Suspense fallback={<div className="min-h-dvh bg-[var(--bg-primary)]" />}>
            <AcceptSponsoredPartnerInvitationClient />
        </Suspense>
    );
}
