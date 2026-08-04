import json
from pathlib import Path

from app.core.build_info import build_info
from app.core.config import Settings


ROOT = Path(__file__).resolve().parents[2]


def test_release_version_sources_stay_in_sync():
    release_version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    frontend_package = json.loads(
        (ROOT / "frontend" / "package.json").read_text(encoding="utf-8")
    )

    assert release_version == "1.2.7"
    assert Settings.model_fields["APP_VERSION"].default == release_version
    assert frontend_package["version"] == release_version


def test_build_info_shortens_valid_revision_and_rejects_untrusted_values():
    assert build_info("1.1.1", "a" * 40) == {
        "version": "1.1.1",
        "revision": "aaaaaaaaaaaa",
    }
    assert build_info("1.1.1", "unknown") == {
        "version": "1.1.1",
        "revision": "unknown",
    }
    assert build_info("1.1.1", "<script>alert(1)</script>") == {
        "version": "1.1.1",
        "revision": "unknown",
    }
