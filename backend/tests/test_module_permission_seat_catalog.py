"""Keep the product, authorization, and seat catalogue complete."""

from pathlib import Path

from app.services.entitlement_catalog import FEATURE_CODES, QUOTA_CODES
from app.services.organization_base_profile_service import DEFAULT_PERMISSION_DEFINITIONS
from app.services.organization_permission_policy import SYSTEM_ONLY_PERMISSION_CODES


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
CATALOG_PATH = REPOSITORY_ROOT / "docs/engineering/MODULE_PERMISSION_SEAT_CATALOG.md"


def test_catalog_documents_every_entitlement_and_base_permission():
    catalog = CATALOG_PATH.read_text(encoding="utf-8")
    documented_codes = set((*FEATURE_CODES, *QUOTA_CODES))
    documented_codes.update(code for code, _, _ in DEFAULT_PERMISSION_DEFINITIONS)

    missing_codes = sorted(
        code for code in documented_codes if f"`{code}`" not in catalog
    )

    assert not missing_codes, (
        "Update the module, permission, and seat catalogue for: "
        f"{', '.join(missing_codes)}"
    )


def test_catalog_documents_all_system_only_permissions_and_seat_classes():
    catalog = CATALOG_PATH.read_text(encoding="utf-8")

    missing_permissions = sorted(
        code for code in SYSTEM_ONLY_PERMISSION_CODES if f"`{code}`" not in catalog
    )

    assert not missing_permissions, (
        "Document system-only permissions in the catalogue: "
        f"{', '.join(missing_permissions)}"
    )
    for access_class in ("admin", "responsible", "worker"):
        assert f"`{access_class}`" in catalog
