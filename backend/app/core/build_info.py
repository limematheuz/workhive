import re


SEMVER_PATTERN = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
GIT_SHA_PATTERN = re.compile(r"^[0-9a-f]{7,40}$")


def normalized_version(value: str) -> str:
    candidate = value.strip()
    return candidate if SEMVER_PATTERN.fullmatch(candidate) else "0.0.0-dev"


def normalized_revision(value: str) -> str:
    candidate = value.strip().lower()
    if candidate == "unknown":
        return candidate
    return candidate[:12] if GIT_SHA_PATTERN.fullmatch(candidate) else "unknown"


def build_info(version: str, revision: str) -> dict[str, str]:
    return {
        "version": normalized_version(version),
        "revision": normalized_revision(revision),
    }
