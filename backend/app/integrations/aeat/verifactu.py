from dataclasses import dataclass
from pathlib import Path

from app.core.config import settings


TEST_ENDPOINT = (
    "https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/"
    "SistemaFacturacion/VerifactuSOAP"
)
PRODUCTION_ENDPOINT = (
    "https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/"
    "SistemaFacturacion/VerifactuSOAP"
)


@dataclass(frozen=True)
class VerifactuReadiness:
    enabled: bool
    environment: str
    certificate_configured: bool
    producer_configured: bool
    official_schemas_available: bool
    submission_available: bool
    endpoint: str


def aeat_endpoint(environment: str | None = None) -> str:
    selected_environment = environment or settings.VERIFACTU_ENVIRONMENT
    if selected_environment == "production":
        return PRODUCTION_ENDPOINT
    return TEST_ENDPOINT


def get_verifactu_readiness() -> VerifactuReadiness:
    certificate_path = settings.VERIFACTU_CERTIFICATE_PATH
    certificate_configured = bool(
        certificate_path
        and settings.VERIFACTU_CERTIFICATE_PASSWORD
        and Path(certificate_path).expanduser().is_file()
    )
    producer_configured = bool(
        settings.VERIFACTU_SOFTWARE_PRODUCER_NAME
        and settings.VERIFACTU_SOFTWARE_PRODUCER_TAX_ID
    )
    schema_path = Path(__file__).with_name("schemas") / "SuministroLR.xsd"
    official_schemas_available = schema_path.is_file()
    return VerifactuReadiness(
        enabled=settings.VERIFACTU_ENABLED,
        environment=settings.VERIFACTU_ENVIRONMENT,
        certificate_configured=certificate_configured,
        producer_configured=producer_configured,
        official_schemas_available=official_schemas_available,
        submission_available=(
            settings.VERIFACTU_ENABLED
            and certificate_configured
            and producer_configured
            and official_schemas_available
        ),
        endpoint=aeat_endpoint(),
    )
