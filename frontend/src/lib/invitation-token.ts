export type InvitationTokenSource = "fragment" | "query" | "fallback" | "missing";

export type ResolvedInvitationToken = {
    token: string;
    source: InvitationTokenSource;
    shouldClearUrl: boolean;
};

function normalizeToken(value: string | null | undefined): string {
    return value?.trim() ?? "";
}

/**
 * Resolve an invitation token without letting URL cleanup discard it.
 *
 * Email links keep the secret in the fragment so it is not sent to the
 * server. A legacy query token and a server-side fallback remain supported
 * for existing links and the company-invitation sign-in handoff.
 */
export function resolveInvitationToken({
    hash,
    queryToken,
    fallbackToken,
}: {
    hash: string;
    queryToken?: string | null;
    fallbackToken?: string | null;
}): ResolvedInvitationToken {
    const fragmentToken = normalizeToken(new URLSearchParams(hash.replace(/^#/, "")).get("token"));
    if (fragmentToken) {
        return { token: fragmentToken, source: "fragment", shouldClearUrl: true };
    }

    const legacyToken = normalizeToken(queryToken);
    if (legacyToken) {
        return { token: legacyToken, source: "query", shouldClearUrl: true };
    }

    const persistedToken = normalizeToken(fallbackToken);
    if (persistedToken) {
        return { token: persistedToken, source: "fallback", shouldClearUrl: false };
    }

    return { token: "", source: "missing", shouldClearUrl: false };
}
