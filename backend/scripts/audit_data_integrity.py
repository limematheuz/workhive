#!/usr/bin/env python3
import sys
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.session import SessionLocal  # noqa: E402
from app.services.data_integrity import audit_data_integrity  # noqa: E402


def main() -> int:
    with SessionLocal() as db:
        issues = audit_data_integrity(db)

    if not issues:
        print("Data integrity audit passed: no orphaned or cross-company records found.")
        return 0

    print("Data integrity audit failed:")
    for issue in issues:
        samples = ", ".join(str(value) for value in issue.sample_ids) or "none"
        print(f"- {issue.check}: {issue.count} row(s); sample IDs: {samples}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
