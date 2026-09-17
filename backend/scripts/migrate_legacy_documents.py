"""Inspect or copy legacy fiscal files into private object storage.

Run a dry run first. Applying a migration requires an explicit company scope or
``--all``. Source files are never deleted by this command.
"""

import argparse
import json

from app.db.session import SessionLocal
from app.services.legacy_document_storage_migration_service import (
    migrate_legacy_documents,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write verified object-storage copies and clear legacy DB paths",
    )
    scope = parser.add_mutually_exclusive_group()
    scope.add_argument(
        "--company-id",
        action="append",
        type=int,
        help="Limit the run to one company; repeat for multiple companies",
    )
    scope.add_argument(
        "--all",
        action="store_true",
        help="Allow an applied migration for every company",
    )
    arguments = parser.parse_args()
    if arguments.apply and not (arguments.company_id or arguments.all):
        parser.error("--apply requires --company-id or --all")
    return arguments


def main() -> int:
    arguments = parse_args()
    company_ids = set(arguments.company_id) if arguments.company_id else None
    with SessionLocal() as db:
        report = migrate_legacy_documents(
            db,
            apply=arguments.apply,
            company_ids=company_ids,
        )
    print(json.dumps(report.as_dict(), sort_keys=True))
    return 1 if report.failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
