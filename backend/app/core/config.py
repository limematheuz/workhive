from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.build_info import GIT_SHA_PATTERN, SEMVER_PATTERN

class Settings(BaseSettings):
    PROJECT_NAME: str = "WorkHive Enterprise"
    APP_VERSION: str = "1.4.0"
    GIT_SHA: str = "unknown"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str
    MIGRATION_DATABASE_URL: str | None = None
    DATABASE_POOL_SIZE: int = 5
    DATABASE_MAX_OVERFLOW: int = 10
    DATABASE_POOL_RECYCLE_SECONDS: int = 300
    DATABASE_USE_NULL_POOL: bool | None = None
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080
    SESSION_COOKIE_NAME: str = "auth_token"
    CSRF_COOKIE_NAME: str = "csrf_token"
    SESSION_COOKIE_DOMAIN: str | None = None
    SESSION_COOKIE_SAMESITE: str = "lax"
    LOGIN_RATE_LIMIT: int = 10
    REGISTER_RATE_LIMIT: int = 5
    AUTH_RATE_LIMIT_WINDOW_SECONDS: int = 900
    PASSWORD_RESET_RATE_LIMIT: int = 5
    TRIAL_VERIFICATION_RATE_LIMIT: int = 10
    WORKER_INVITATION_RATE_LIMIT: int = 5
    WORKER_INVITATION_MAX_ATTEMPTS: int = 5
    WORKER_INVITATION_EXPIRE_HOURS: int = 72
    CONTACT_RATE_LIMIT: int = 5
    INVOICE_EMAIL_RATE_LIMIT: int = 10
    MEDIA_UPLOAD_RATE_LIMIT: int = 20
    BILLING_SESSION_RATE_LIMIT: int = 10
    CALENDAR_OAUTH_RATE_LIMIT: int = 10
    CALENDAR_OWNERSHIP_REQUEST_RATE_LIMIT: int = 5
    CALENDAR_SYNC_RATE_LIMIT: int = 10
    ALLOW_PUBLIC_REGISTRATION: bool = False
    ENVIRONMENT: str = "development"
    FRONTEND_URL: str = "http://localhost:3000"
    CORS_ORIGINS: str = "http://localhost:3000"
    TRUSTED_HOSTS: str = "localhost,127.0.0.1,testserver"
    FORCE_HTTPS: bool = False
    HEALTH_READY_TOKEN: str | None = None
    LOG_LEVEL: str = "INFO"
    LOG_JSON: bool = False
    RUN_CALENDAR_BACKGROUND_SYNC: bool = False
    TRIAL_EXPIRY_REMINDERS_ENABLED: bool = True
    TRIAL_EXPIRY_REMINDER_INTERVAL_SECONDS: int = 3600
    PAYMENT_REMINDERS_ENABLED: bool = True
    PAYMENT_REMINDER_INTERVAL_SECONDS: int = 3600
    PAYMENT_REMINDER_DAYS_BEFORE_DUE: int = 7
    FISCAL_CALENDAR_REMINDERS_ENABLED: bool = True
    FISCAL_CALENDAR_REMINDER_INTERVAL_SECONDS: int = 3600

    EMAIL_ENABLED: bool = False
    CONTACT_FORM_ENABLED: bool = False
    ACCOUNT_REQUEST_NOTIFICATIONS_ENABLED: bool = True
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_FROM_EMAIL: str | None = None
    SMTP_USE_TLS: bool = True
    SMTP_USE_SSL: bool = False
    CONTACT_RECIPIENT_EMAIL: str | None = None
    ACCOUNT_REQUEST_RECIPIENT_EMAIL: str | None = None

    SUBSCRIPTION_ENFORCEMENT_ENABLED: bool = False
    BILLING_ENABLED: bool = False
    STRIPE_SECRET_KEY: str | None = None
    STRIPE_WEBHOOK_SECRET: str | None = None
    STRIPE_BUSINESS_PRICE_ID: str | None = None
    STRIPE_PRO_PRICE_ID: str | None = None
    STRIPE_LIFETIME_PRICE_ID: str | None = None

    VERIFACTU_ENABLED: bool = False
    VERIFACTU_ENVIRONMENT: str = "test"
    VERIFACTU_AUTO_SUBMIT: bool = False
    VERIFACTU_CERTIFICATE_PATH: str | None = None
    VERIFACTU_CERTIFICATE_PASSWORD: str | None = None
    VERIFACTU_SOFTWARE_PRODUCER_NAME: str | None = None
    VERIFACTU_SOFTWARE_PRODUCER_TAX_ID: str | None = None
    VERIFACTU_SOFTWARE_ID: str = "WH"
    VERIFACTU_INSTALLATION_ID: str = "1"
    VERIFACTU_TIMEOUT_SECONDS: int = 30
    VERIFACTU_MAX_RETRIES: int = 8
    INVOICE_PDF_STORAGE_PATH: str = "storage/invoices"
    ELECTRONIC_INVOICE_STORAGE_PATH: str = "storage/electronic-invoices"
    FISCAL_CERTIFICATE_STORAGE_PATH: str = "storage/fiscal-certificates"
    MEDIA_STORAGE_BACKEND: str = "local"
    MEDIA_STORAGE_PATH: str = "storage/media"
    S3_ENDPOINT_URL: str | None = None
    S3_REGION: str = "eu-west-1"
    S3_BUCKET: str | None = None
    S3_ACCESS_KEY_ID: str | None = None
    S3_SECRET_ACCESS_KEY: str | None = None
    FACTURAE_CERTIFICATE_PATH: str | None = None
    FACTURAE_CERTIFICATE_PASSWORD: str | None = None

    GOOGLE_CALENDAR_ENABLED: bool = False
    GOOGLE_CALENDAR_CLIENT_ID: str | None = None
    GOOGLE_CALENDAR_CLIENT_SECRET: str | None = None
    GOOGLE_CALENDAR_REDIRECT_URI: str = (
        "http://localhost:8000/api/v1/calendar/google/callback"
    )
    GOOGLE_CALENDAR_TIMEZONE: str = "Europe/Madrid"
    GOOGLE_TOKEN_ENCRYPTION_KEY: str | None = None
    GOOGLE_CALENDAR_BACKGROUND_SYNC_INTERVAL_SECONDS: int = 300

    PRIVACY_POLICY_VERSION: str = "2026-06-15"
    AUDIT_IP_RETENTION_DAYS: int = 90
    DATA_SUBJECT_REQUEST_RETENTION_DAYS: int = 1095
    PRIVACY_REQUEST_RESPONSE_DAYS: int = 30

    @field_validator("ALGORITHM")
    @classmethod
    def validate_algorithm(cls, value: str) -> str:
        if value != "HS256":
            raise ValueError("Only HS256 is supported")
        return value

    @field_validator("DATABASE_USE_NULL_POOL", mode="before")
    @classmethod
    def normalize_optional_database_null_pool(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value

    @field_validator("APP_VERSION")
    @classmethod
    def validate_app_version(cls, value: str) -> str:
        normalized = value.strip()
        if not SEMVER_PATTERN.fullmatch(normalized):
            raise ValueError("APP_VERSION must use semantic versioning")
        return normalized

    @field_validator("GIT_SHA")
    @classmethod
    def validate_git_sha(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized != "unknown" and not GIT_SHA_PATTERN.fullmatch(normalized):
            raise ValueError("GIT_SHA must be unknown or a 7-40 character hexadecimal SHA")
        return normalized

    @field_validator("SESSION_COOKIE_SAMESITE")
    @classmethod
    def validate_cookie_samesite(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in {"lax", "strict", "none"}:
            raise ValueError("SESSION_COOKIE_SAMESITE must be lax, strict, or none")
        return normalized

    @field_validator("LOG_LEVEL")
    @classmethod
    def validate_log_level(cls, value: str) -> str:
        normalized = value.upper()
        if normalized not in {"DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"}:
            raise ValueError("LOG_LEVEL must be DEBUG, INFO, WARNING, ERROR, or CRITICAL")
        return normalized

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if not self.is_production:
            return self

        if len(self.SECRET_KEY) < 32 or self.SECRET_KEY.lower() in {
            "change-me",
            "secret",
            "your-secret-key",
        }:
            raise ValueError("Production requires a unique SECRET_KEY with at least 32 characters")

        if not self.FRONTEND_URL.startswith("https://"):
            raise ValueError("Production FRONTEND_URL must use HTTPS")

        if any(not origin.startswith("https://") for origin in self.cors_origins):
            raise ValueError("Production CORS_ORIGINS must contain only HTTPS origins")

        if "*" in self.cors_origins:
            raise ValueError("Production CORS_ORIGINS cannot contain a wildcard")

        if not self.trusted_hosts or "*" in self.trusted_hosts:
            raise ValueError("Production TRUSTED_HOSTS must list explicit hosts")

        if not self.FORCE_HTTPS:
            raise ValueError("Production requires FORCE_HTTPS=true")

        if self.SMTP_USE_TLS and self.SMTP_USE_SSL:
            raise ValueError("SMTP_USE_TLS and SMTP_USE_SSL cannot both be enabled")

        if self.EMAIL_ENABLED and not all(
            [self.SMTP_HOST, self.SMTP_FROM_EMAIL]
        ):
            raise ValueError(
                "EMAIL_ENABLED requires SMTP_HOST, SMTP_FROM_EMAIL"
            )

        if self.CONTACT_FORM_ENABLED and (
            not self.EMAIL_ENABLED or not self.CONTACT_RECIPIENT_EMAIL
        ):
            raise ValueError(
                "CONTACT_FORM_ENABLED requires EMAIL_ENABLED and CONTACT_RECIPIENT_EMAIL"
            )

        if self.ALLOW_PUBLIC_REGISTRATION and self.ACCOUNT_REQUEST_NOTIFICATIONS_ENABLED and (
            not self.EMAIL_ENABLED or not self.ACCOUNT_REQUEST_RECIPIENT_EMAIL
        ):
            raise ValueError(
                "Public registration requires EMAIL_ENABLED and ACCOUNT_REQUEST_RECIPIENT_EMAIL"
            )

        if self.BILLING_ENABLED and not all(
            [
                self.STRIPE_SECRET_KEY,
                self.STRIPE_WEBHOOK_SECRET,
                self.STRIPE_BUSINESS_PRICE_ID,
                self.STRIPE_PRO_PRICE_ID,
            ]
        ):
            raise ValueError("Billing requires Stripe secret, webhook secret, and price IDs")

        if self.VERIFACTU_ENABLED and not all(
            [
                self.VERIFACTU_CERTIFICATE_PATH,
                self.VERIFACTU_CERTIFICATE_PASSWORD,
                self.VERIFACTU_SOFTWARE_PRODUCER_NAME,
                self.VERIFACTU_SOFTWARE_PRODUCER_TAX_ID,
            ]
        ):
            raise ValueError(
                "VERIFACTU_ENABLED requires certificate and software producer identity"
            )

        if self.GOOGLE_CALENDAR_ENABLED and not all(
            [
                self.GOOGLE_CALENDAR_CLIENT_ID,
                self.GOOGLE_CALENDAR_CLIENT_SECRET,
                self.GOOGLE_TOKEN_ENCRYPTION_KEY,
            ]
        ):
            raise ValueError(
                "Google Calendar requires OAuth credentials and a token encryption key"
            )

        if self.MEDIA_STORAGE_BACKEND == "s3" and not self.S3_BUCKET:
            raise ValueError(
                "S3 media storage requires a bucket"
            )

        if self.SESSION_COOKIE_SAMESITE == "none" and not self.FORCE_HTTPS:
            raise ValueError("SameSite=None cookies require HTTPS")

        return self

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def trusted_hosts(self) -> list[str]:
        return [host.strip() for host in self.TRUSTED_HOSTS.split(",") if host.strip()]

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.lower() == "production"

    @property
    def smtp_is_configured(self) -> bool:
        return bool(
            self.EMAIL_ENABLED
            and self.SMTP_HOST
            and self.SMTP_FROM_EMAIL
        )

    @property
    def migration_database_url(self) -> str:
        from app.core.database_url import to_sync_database_url

        return to_sync_database_url(self.MIGRATION_DATABASE_URL or self.DATABASE_URL)

    @property
    def sync_database_url(self) -> str:
        from app.core.database_url import to_sync_database_url

        return to_sync_database_url(self.DATABASE_URL)

    @property
    def async_database_url(self) -> str:
        from app.core.database_url import to_async_database_url

        return to_async_database_url(self.DATABASE_URL)

    @property
    def use_null_pool(self) -> bool:
        return self.DATABASE_USE_NULL_POOL is True

    @property
    def stripe_price_ids(self) -> dict[str, str]:
        prices = {
            "business": self.STRIPE_BUSINESS_PRICE_ID,
            "pro": self.STRIPE_PRO_PRICE_ID,
            "lifetime": self.STRIPE_LIFETIME_PRICE_ID,
        }
        return {key: value for key, value in prices.items() if value}

    @property
    def facturae_certificate_path(self) -> str | None:
        return self.FACTURAE_CERTIFICATE_PATH or self.VERIFACTU_CERTIFICATE_PATH

    @property
    def facturae_certificate_password(self) -> str | None:
        return (
            self.FACTURAE_CERTIFICATE_PASSWORD
            or self.VERIFACTU_CERTIFICATE_PASSWORD
        )

    @field_validator("MEDIA_STORAGE_BACKEND")
    @classmethod
    def validate_media_storage_backend(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in {"local", "s3"}:
            raise ValueError("MEDIA_STORAGE_BACKEND must be local or s3")
        return normalized

    @field_validator("VERIFACTU_ENVIRONMENT")
    @classmethod
    def validate_verifactu_environment(cls, value: str) -> str:
        normalized = value.lower()
        if normalized not in {"test", "production"}:
            raise ValueError("VERIFACTU_ENVIRONMENT must be test or production")
        return normalized

    @field_validator("VERIFACTU_SOFTWARE_ID")
    @classmethod
    def validate_verifactu_software_id(cls, value: str) -> str:
        normalized = value.strip()
        if not 1 <= len(normalized) <= 2:
            raise ValueError("VERIFACTU_SOFTWARE_ID must contain 1 or 2 characters")
        return normalized

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

settings = Settings()

# Trigger reload for .env changes
