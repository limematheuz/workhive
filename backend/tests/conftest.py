import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from app.main import app
from app.db.base import Base
from app.api.deps import get_async_db, get_db
from app.models.role import Role
from app.core.config import settings




SQLALCHEMY_TEST_DATABASE_URL = "sqlite://"
engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class AsyncSessionAdapter:
    """Async test boundary backed by the same isolated sync SQLite transaction."""

    def __init__(self, session):
        self.session = session

    async def execute(self, statement, *args, **kwargs):
        return self.session.execute(statement, *args, **kwargs)

    async def scalar(self, statement, *args, **kwargs):
        return self.session.scalar(statement, *args, **kwargs)

    async def scalars(self, statement, *args, **kwargs):
        return self.session.scalars(statement, *args, **kwargs)

    async def commit(self):
        self.session.commit()

    async def rollback(self):
        self.session.rollback()

    async def refresh(self, instance):
        self.session.refresh(instance)

    async def run_sync(self, operation, *args, **kwargs):
        return operation(self.session, *args, **kwargs)


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

    async def override_get_async_db():
        yield AsyncSessionAdapter(db)

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_async_db] = override_get_async_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
