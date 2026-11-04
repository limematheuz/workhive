import Link from "next/link";
import type { Dictionary } from "@/lib/dictionary-context";
import type { LoginAccessBlock } from "@/lib/login-access";
import { Button } from "@/components/ui/button";

export function LoginAccessFeedback({ reason, copy }: {
    reason: LoginAccessBlock;
    copy: Dictionary["auth"]["access_blocked"];
}) {
    return <section role="alert" className="space-y-3 rounded-2xl border border-[var(--btn-cancel-border)] bg-[var(--btn-cancel-bg)] p-4 text-sm text-[var(--btn-cancel-text)]">
        <p className="font-semibold">{reason === "trial_expired" ? copy.trial_expired : copy.unavailable}</p>
        <p>{copy.help}</p>
        <Button asChild variant="outline" size="sm"><Link href="/contact?reason=account-access">{copy.contact}</Link></Button>
    </section>;
}
