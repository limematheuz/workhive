import { Suspense } from "react";

import AcceptClientPortalInvitationClient from "./AcceptClientPortalInvitationClient";

export default function AcceptClientPortalInvitationPage() {
    return <Suspense fallback={<div className="min-h-dvh bg-[var(--bg-primary)]" />}><AcceptClientPortalInvitationClient /></Suspense>;
}
