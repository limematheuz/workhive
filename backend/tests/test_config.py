import pytest
from pydantic import ValidationError

from app.core.config import Settings


def production_settings(**overrides) -> Settings:
    values = {
        "DATABASE_URL": "postgresql://user:password@db.example.com/workhive",
        "SECRET_KEY": "a-production-secret-that-is-long-enough",
        "ENVIRONMENT": "production",
        "FRONTEND_URL": "https://app.workhive.example",
        "CORS_ORIGINS": "https://app.workhive.example",
        "TRUSTED_HOSTS": "api.workhive.example",
        "FORCE_HTTPS": True,
        "EMAIL_ENABLED": True,
        "CONTACT_FORM_ENABLED": True,
        "SMTP_HOST": "smtp.example.com",
        "SMTP_FROM_EMAIL": "support@workhive.example",
        "CONTACT_RECIPIENT_EMAIL": "contact@workhive.example",
    }
    values.update(overrides)
    return Settings(**values)


def test_production_settings_accept_secure_configuration():
    settings = production_settings()

    assert settings.is_production is True
    assert settings.smtp_is_configured is True


@pytest.mark.parametrize(
    ("override", "expected_message"),
    [
        ({"SECRET_KEY": "secret"}, "unique SECRET_KEY"),
        ({"FRONTEND_URL": "http://app.example.com"}, "FRONTEND_URL must use HTTPS"),
        ({"CORS_ORIGINS": "http://app.example.com"}, "only HTTPS origins"),
        ({"FORCE_HTTPS": False}, "FORCE_HTTPS=true"),
        ({"SMTP_HOST": None}, "SMTP_HOST, SMTP_FROM_EMAIL"),
        ({"CONTACT_RECIPIENT_EMAIL": None}, "CONTACT_RECIPIENT_EMAIL"),
    ],
)
def test_production_settings_reject_insecure_configuration(
    override: dict[str, object],
    expected_message: str,
):
    with pytest.raises(ValidationError, match=expected_message):
        production_settings(**override)


def test_production_rejects_incomplete_billing_configuration():
    with pytest.raises(ValidationError, match="Billing requires Stripe"):
        production_settings(BILLING_ENABLED=True)


def test_production_public_registration_requires_a_workhive_notification_inbox():
    with pytest.raises(ValidationError, match="ACCOUNT_REQUEST_RECIPIENT_EMAIL"):
        production_settings(
            ALLOW_PUBLIC_REGISTRATION=True,
            ACCOUNT_REQUEST_RECIPIENT_EMAIL=None,
        )


@pytest.mark.parametrize(
    "override",
    [
        {"CORS_ORIGINS": "*"},
        {"TRUSTED_HOSTS": "*"},
    ],
)
def test_production_rejects_wildcard_origins_and_hosts(
    override: dict[str, object],
):
    with pytest.raises(ValidationError):
        production_settings(**override)


def test_production_allows_explicitly_disabled_email_features():
    settings = production_settings(
        EMAIL_ENABLED=False,
        CONTACT_FORM_ENABLED=False,
        SMTP_HOST=None,
        SMTP_FROM_EMAIL=None,
        CONTACT_RECIPIENT_EMAIL=None,
    )

    assert settings.smtp_is_configured is False


def test_explicit_null_pool_setting_is_respected():
    assert production_settings(DATABASE_USE_NULL_POOL=True).use_null_pool is True
    assert production_settings(DATABASE_USE_NULL_POOL=False).use_null_pool is False
