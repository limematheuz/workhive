import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db.base import Base
from app.api.deps import get_db
from app.models.role import Role
from app.core.config import settings




SQLALCHEMY_TEST_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def isolated_invoice_pdf_storage(tmp_path, monkeypatch):
    monkeypatch.setattr(
        settings,
        "INVOICE_PDF_STORAGE_PATH",
        str(tmp_path / "invoice-pdfs"),
    )
    monkeypatch.setattr(
        settings,
        "ELECTRONIC_INVOICE_STORAGE_PATH",
        str(tmp_path / "electronic-invoices"),
    )
    monkeypatch.setattr(
        settings,
        "FISCAL_CERTIFICATE_STORAGE_PATH",
        str(tmp_path / "fiscal-certificates"),
    )
    monkeypatch.setattr(settings, "MEDIA_STORAGE_BACKEND", "local")
    monkeypatch.setattr(
        settings,
        "MEDIA_STORAGE_PATH",
        str(tmp_path / "media"),
    )
    monkeypatch.setattr(settings, "EMAIL_ENABLED", True)
    monkeypatch.setattr(settings, "CONTACT_FORM_ENABLED", True)
    monkeypatch.setattr(settings, "SMTP_HOST", "smtp.test.local")
    monkeypatch.setattr(settings, "SMTP_FROM_EMAIL", "noreply@workhive.test")
    monkeypatch.setattr(settings, "CONTACT_RECIPIENT_EMAIL", "support@workhive.test")


@pytest.fixture()
def db():
    previous_registration_setting = settings.ALLOW_PUBLIC_REGISTRATION
    settings.ALLOW_PUBLIC_REGISTRATION = True
    Base.metadata.create_all(bind=engine)
    session = TestingSessionLocal()

    roles = [
        Role(id=1, name="admin", description="Admin"),
        Role(id=2, name="manager", description="Manager"),
        Role(id=3, name="viewer", description="Viewer"),
        Role(id=4, name="superadmin", description="Superadmin"),
    ]
    session.add_all(roles)
    session.commit()

    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)
        settings.ALLOW_PUBLIC_REGISTRATION = previous_registration_setting


@pytest.fixture()
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
