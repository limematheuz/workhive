from email.message import EmailMessage

from app.services.email_service import layout


def test_button_escapes_url_and_label():
    html = layout.button('https://x.test/?q="a"<b>', "<Click>")
    assert "<Click>" not in html
    assert "&lt;Click&gt;" in html
    assert "&quot;a&quot;" in html
    assert "&lt;b&gt;" in html


def test_base_layout_includes_preview_and_locale():
    html = layout.base_layout("<p>Body</p>", preview_text="Preview <x>", locale="en")
    assert "lang=\"en\"" in html
    assert "Smart business management" in html
    assert "Preview &lt;x&gt;" in html
    assert "<p>Body</p>" in html


def test_base_layout_defaults_to_spanish_footer():
    html = layout.base_layout("<p>Body</p>")
    assert "lang=\"es\"" in html
    assert "Gestión empresarial inteligente" in html


def test_add_logo_to_message_is_safe_without_html_part(tmp_path, monkeypatch):
    monkeypatch.setattr(layout, "_LOGO_PATH", tmp_path / "missing.png")
    message = EmailMessage()
    message.set_content("plain only")
    layout.add_logo_to_message(message)
    assert not any(part.get("Content-ID") in {"logo", "<logo>"} for part in message.walk())


def test_add_logo_embeds_when_file_exists(tmp_path, monkeypatch):
    logo = tmp_path / "black-logo.png"
    logo.write_bytes(b"png-bytes")
    monkeypatch.setattr(layout, "_LOGO_PATH", logo)

    message = EmailMessage()
    message.set_content("plain")
    message.add_alternative("<html><body>Hi</body></html>", subtype="html")
    layout.add_logo_to_message(message)

    assert any(part.get("Content-ID") in {"logo", "<logo>"} for part in message.walk())


def test_get_logo_header_falls_back_to_text(tmp_path, monkeypatch):
    monkeypatch.setattr(layout, "_LOGO_PATH", tmp_path / "missing.png")
    assert "WorkHive" in layout.get_logo_header()
    assert "cid:logo" not in layout.get_logo_header()


def test_get_logo_header_uses_cid_when_logo_exists(tmp_path, monkeypatch):
    logo = tmp_path / "black-logo.png"
    logo.write_bytes(b"png")
    monkeypatch.setattr(layout, "_LOGO_PATH", logo)
    assert "cid:logo" in layout.get_logo_header()
