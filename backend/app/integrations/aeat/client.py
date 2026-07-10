from dataclasses import dataclass

import httpx
from lxml import etree

from app.core.config import settings
from app.integrations.aeat.certificate import pkcs12_ssl_context
from app.integrations.aeat.verifactu import aeat_endpoint
from app.integrations.aeat.xml import build_soap_envelope


@dataclass(frozen=True)
class AeatSubmissionResult:
    status: str
    csv: str | None
    error_code: str | None
    error_message: str | None
    response_xml: str
    response_data: dict


def _first_text(root, name: str) -> str | None:
    values = root.xpath(f"//*[local-name()='{name}']/text()")
    if not values:
        return None
    return str(values[0]).strip()


def parse_aeat_response(response_xml: str) -> AeatSubmissionResult:
    parser = etree.XMLParser(resolve_entities=False, no_network=True)
    root = etree.fromstring(response_xml.encode("utf-8"), parser)
    fault = _first_text(root, "faultstring")
    if fault:
        return AeatSubmissionResult(
            status="rejected",
            csv=None,
            error_code=_first_text(root, "faultcode"),
            error_message=fault,
            response_xml=response_xml,
            response_data={"soap_fault": fault},
        )

    record_status = _first_text(root, "EstadoRegistro")
    delivery_status = _first_text(root, "EstadoEnvio")
    mapped_status = {
        "Correcto": "accepted",
        "AceptadoConErrores": "accepted_with_errors",
        "ParcialmenteCorrecto": "accepted_with_errors",
        "Incorrecto": "rejected",
    }.get(record_status or delivery_status, "rejected")
    error_code = _first_text(root, "CodigoErrorRegistro")
    error_message = _first_text(root, "DescripcionErrorRegistro")
    csv = _first_text(root, "CSV")
    return AeatSubmissionResult(
        status=mapped_status,
        csv=csv,
        error_code=error_code,
        error_message=error_message,
        response_xml=response_xml,
        response_data={
            "delivery_status": delivery_status,
            "record_status": record_status,
            "error_code": error_code,
            "error_message": error_message,
            "csv": csv,
            "wait_seconds": _first_text(root, "TiempoEsperaEnvio"),
        },
    )


def submit_record(
    submission_xml: str,
    *,
    certificate_path: str | None = None,
    certificate_password: str | None = None,
    environment: str | None = None,
) -> AeatSubmissionResult:
    certificate_path = certificate_path or settings.VERIFACTU_CERTIFICATE_PATH
    certificate_password = certificate_password or settings.VERIFACTU_CERTIFICATE_PASSWORD
    if not certificate_path or not certificate_password:
        raise ValueError("VERI*FACTU certificate is not configured")

    with pkcs12_ssl_context(
        certificate_path,
        certificate_password,
    ) as ssl_context:
        with httpx.Client(
            verify=ssl_context,
            timeout=settings.VERIFACTU_TIMEOUT_SECONDS,
            trust_env=False,
        ) as client:
            response = client.post(
                aeat_endpoint(environment),
                content=build_soap_envelope(submission_xml),
                headers={
                    "Content-Type": "text/xml; charset=utf-8",
                    "SOAPAction": '""',
                },
            )
            response.raise_for_status()
    return parse_aeat_response(response.text)
