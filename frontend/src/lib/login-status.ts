/** Shared login status feedback: same motion for fail + success variants. */

export type LoginStatusVariant = "error" | "success";

export const LOGIN_SUCCESS_REDIRECT_MS = 2200;
export const LOGIN_STATUS_PHRASE_INTERVAL_MS = 750;

export function resolveLoginStatusPhrases(
    variant: LoginStatusVariant,
    phrases: readonly string[] | undefined,
    fallback: string,
): string[] {
    const cleaned = (phrases ?? []).reduce<string[]>((result, phrase) => {
        const trimmedPhrase = phrase.trim();
        if (trimmedPhrase) result.push(trimmedPhrase);
        return result;
    }, []);
    if (cleaned.length > 0) return cleaned;
    return [fallback];
}

export function loginStatusRedirectDelayMs(phraseCount: number): number {
    const cycles = Math.max(phraseCount, 1);
    return Math.max(
        LOGIN_SUCCESS_REDIRECT_MS,
        cycles * LOGIN_STATUS_PHRASE_INTERVAL_MS + 400,
    );
}
