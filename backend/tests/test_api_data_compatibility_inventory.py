"""Keep the API/data compatibility inventory aligned with registered routes."""

from pathlib import Path
import re


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
INVENTORY_PATH = REPOSITORY_ROOT / "docs/engineering/API_AND_DATA_COMPATIBILITY_INVENTORY.md"
ROUTER_PATH = REPOSITORY_ROOT / "backend/app/api/v1/router.py"


def test_inventory_covers_every_directly_registered_api_prefix():
    inventory = INVENTORY_PATH.read_text(encoding="utf-8")
    router = ROUTER_PATH.read_text(encoding="utf-8")
    registered_prefixes = set(re.findall(r'prefix="([^"]+)"', router))

    missing_prefixes = sorted(
        prefix for prefix in registered_prefixes if f"`{prefix}`" not in inventory
    )

    assert not missing_prefixes, (
        "Update the API/data compatibility inventory for registered prefixes: "
        f"{', '.join(missing_prefixes)}"
    )


def test_inventory_identifies_the_public_api_and_data_transition_sources():
    inventory = INVENTORY_PATH.read_text(encoding="utf-8")

    for source in (
        "backend/app/api/v1/public_api.py",
        "backend/app/services/entitlement_catalog.py",
        "j9k0l1m2n3o4_add_enterprise_access_foundation.py",
        "f9a0b1c2d3e4_add_external_access_grants.py",
        "backend/scripts/migrate_legacy_documents.py",
    ):
        assert source in inventory
