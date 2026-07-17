const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const GIT_SHA_PATTERN = /^[0-9a-f]{7,40}$/;

export type PublicBuildInfo = {
    version: string;
    revision: string;
    label: string;
};

export function createBuildInfo(version: string | undefined, revision: string | undefined): PublicBuildInfo {
    const versionCandidate = version?.trim() ?? "";
    const normalizedVersion = SEMVER_PATTERN.test(versionCandidate)
        ? versionCandidate
        : "0.0.0-dev";
    const revisionCandidate = revision?.trim().toLowerCase() ?? "";
    const normalizedRevision = GIT_SHA_PATTERN.test(revisionCandidate)
        ? revisionCandidate.slice(0, 12)
        : "unknown";

    return {
        version: normalizedVersion,
        revision: normalizedRevision,
        label: normalizedRevision === "unknown"
            ? `v${normalizedVersion}`
            : `v${normalizedVersion} · ${normalizedRevision}`,
    };
}

export const publicBuildInfo = createBuildInfo(
    process.env.NEXT_PUBLIC_APP_VERSION,
    process.env.NEXT_PUBLIC_GIT_SHA,
);
