from types import SimpleNamespace

from app.core.config import settings
from app.services.invoice_pdf_qr import show_verifactu_legend


def _invoice(status: str):
    return SimpleNamespace(fiscal_submission_status=status)


def test_verifactu_legend_is_not_printed_when_submission_is_unavailable(monkeypatch):
    monkeypatch.setattr(settings, "VERIFACTU_ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "VERIFACTU_AUTO_SUBMIT", True)
    assert not show_verifactu_legend(_invoice("not_configured"))


def test_verifactu_legend_is_not_printed_for_test_or_manual_submission(monkeypatch):
    monkeypatch.setattr(settings, "VERIFACTU_AUTO_SUBMIT", True)
    monkeypatch.setattr(settings, "VERIFACTU_ENVIRONMENT", "test")
    assert not show_verifactu_legend(_invoice("pending_submission"))
    monkeypatch.setattr(settings, "VERIFACTU_ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "VERIFACTU_AUTO_SUBMIT", False)
    assert not show_verifactu_legend(_invoice("pending_submission"))


def test_verifactu_legend_is_printed_for_operational_production_mode(monkeypatch):
    monkeypatch.setattr(settings, "VERIFACTU_ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "VERIFACTU_AUTO_SUBMIT", True)
    assert show_verifactu_legend(_invoice("pending_submission"))
    monkeypatch.setattr(settings, "VERIFACTU_AUTO_SUBMIT", False)
    assert show_verifactu_legend(_invoice("accepted"))
