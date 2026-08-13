import re


SWIFT_BIC_RE = re.compile(
    r"^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$"
)


def normalize_swift_bic(value: str | None) -> str | None:
    """Normalize an optional SWIFT/BIC code and reject malformed values."""
    if value is None:
        return None

    normalized = "".join(value.split()).upper()
    if not normalized:
        return None
    if not SWIFT_BIC_RE.fullmatch(normalized):
        raise ValueError(
            "SWIFT/BIC must contain 8 or 11 letters and numbers in a valid format"
        )
    return normalized
