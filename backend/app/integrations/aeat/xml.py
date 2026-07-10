from pathlib import Path
from urllib.parse import urlencode

from lxml import etree

from app.core.config import settings


NS_SOAP = "http://schemas.xmlsoap.org/soap/envelope/"
NS_LR = (
    "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/"
    "aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd"
)
NS_INFO = (
    "https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/"
    "aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd"
)
NS_DS = "http://www.w3.org/2000/09/xmldsig#"
SCHEMA_DIRECTORY = Path(__file__).with_name("schemas")


class _LocalSchemaResolver(etree.Resolver):
    def resolve(self, url, public_id, context):
        filename = url.rsplit("/", 1)[-1]
        local = SCHEMA_DIRECTORY / filename
        if local.is_file():
            return self.resolve_filename(str(local), context)
        return None


def _element(parent, namespace: str, name: str, value=None):
    child = etree.SubElement(parent, etree.QName(namespace, name))
    if value is not None:
        child.text = str(value)
    return child


def _party(parent, name: str, tax_id: str) -> None:
    _element(parent, NS_INFO, "NombreRazon", name[:120])
    _element(parent, NS_INFO, "NIF", tax_id)


def _system(parent, data: dict) -> None:
    system = _element(parent, NS_INFO, "SistemaInformatico")
    _party(system, data["producer_name"], data["producer_tax_id"])
    _element(
        system,
        NS_INFO,
        "NombreSistemaInformatico",
        data["software_name"][:30],
    )
    _element(system, NS_INFO, "IdSistemaInformatico", data["software_id"])
    _element(system, NS_INFO, "Version", data["software_version"][:50])
    _element(
        system,
        NS_INFO,
        "NumeroInstalacion",
        data["installation_id"][:100],
    )
    _element(system, NS_INFO, "TipoUsoPosibleSoloVerifactu", "S")
    _element(system, NS_INFO, "TipoUsoPosibleMultiOT", "S")
    _element(system, NS_INFO, "IndicadorMultiplesOT", "N")


def _chain(parent, data: dict) -> None:
    chain = _element(parent, NS_INFO, "Encadenamiento")
    previous = data.get("previous_record")
    if not previous:
        _element(chain, NS_INFO, "PrimerRegistro", "S")
        return
    previous_node = _element(chain, NS_INFO, "RegistroAnterior")
    _element(
        previous_node,
        NS_INFO,
        "IDEmisorFactura",
        previous["issuer_tax_id"],
    )
    _element(
        previous_node,
        NS_INFO,
        "NumSerieFactura",
        previous["invoice_number"],
    )
    _element(
        previous_node,
        NS_INFO,
        "FechaExpedicionFactura",
        previous["issue_date"],
    )
    _element(previous_node, NS_INFO, "Huella", previous["record_hash"])


def build_registration_xml(data: dict) -> str:
    root = etree.Element(
        etree.QName(NS_LR, "RegFactuSistemaFacturacion"),
        nsmap={"sum": NS_LR, "sum1": NS_INFO, "ds": NS_DS},
    )
    header = _element(root, NS_LR, "Cabecera")
    obliged = _element(header, NS_INFO, "ObligadoEmision")
    _party(obliged, data["issuer_name"], data["issuer_tax_id"])

    wrapper = _element(root, NS_LR, "RegistroFactura")
    record = _element(wrapper, NS_INFO, "RegistroAlta")
    _element(record, NS_INFO, "IDVersion", "1.0")
    invoice_id = _element(record, NS_INFO, "IDFactura")
    _element(invoice_id, NS_INFO, "IDEmisorFactura", data["issuer_tax_id"])
    _element(invoice_id, NS_INFO, "NumSerieFactura", data["invoice_number"])
    _element(invoice_id, NS_INFO, "FechaExpedicionFactura", data["issue_date"])
    _element(record, NS_INFO, "RefExterna", data["external_reference"])
    _element(record, NS_INFO, "NombreRazonEmisor", data["issuer_name"][:120])
    _element(record, NS_INFO, "TipoFactura", data["invoice_type"])

    if data.get("rectified_invoice"):
        _element(record, NS_INFO, "TipoRectificativa", "I")
        rectified = _element(record, NS_INFO, "FacturasRectificadas")
        rectified_id = _element(rectified, NS_INFO, "IDFacturaRectificada")
        original = data["rectified_invoice"]
        _element(
            rectified_id,
            NS_INFO,
            "IDEmisorFactura",
            original["issuer_tax_id"],
        )
        _element(
            rectified_id,
            NS_INFO,
            "NumSerieFactura",
            original["invoice_number"],
        )
        _element(
            rectified_id,
            NS_INFO,
            "FechaExpedicionFactura",
            original["issue_date"],
        )

    _element(record, NS_INFO, "DescripcionOperacion", data["description"][:500])
    if data.get("invoice_type") == "F2" and not data.get("recipient_tax_id"):
        _element(record, NS_INFO, "FacturaSinIdentifDestinatarioArt61d", "S")
    if data.get("recipient_tax_id"):
        recipients = _element(record, NS_INFO, "Destinatarios")
        recipient = _element(recipients, NS_INFO, "IDDestinatario")
        _party(recipient, data["recipient_name"], data["recipient_tax_id"])

    breakdown = _element(record, NS_INFO, "Desglose")
    for tax in data["tax_breakdown"]:
        detail = _element(breakdown, NS_INFO, "DetalleDesglose")
        _element(detail, NS_INFO, "Impuesto", "01")
        _element(detail, NS_INFO, "ClaveRegimen", "01")
        _element(detail, NS_INFO, "CalificacionOperacion", "S1")
        _element(detail, NS_INFO, "TipoImpositivo", tax["rate"])
        _element(
            detail,
            NS_INFO,
            "BaseImponibleOimporteNoSujeto",
            tax["base"],
        )
        _element(detail, NS_INFO, "CuotaRepercutida", tax["tax"])
        if tax.get("surcharge_rate"):
            _element(
                detail,
                NS_INFO,
                "TipoRecargoEquivalencia",
                tax["surcharge_rate"],
            )
            _element(
                detail,
                NS_INFO,
                "CuotaRecargoEquivalencia",
                tax["surcharge_amount"],
            )

    _element(record, NS_INFO, "CuotaTotal", data["tax_amount"])
    _element(record, NS_INFO, "ImporteTotal", data["total_amount"])
    _chain(record, data)
    _system(record, data)
    _element(record, NS_INFO, "FechaHoraHusoGenRegistro", data["generated_at"])
    _element(record, NS_INFO, "TipoHuella", "01")
    _element(record, NS_INFO, "Huella", data["record_hash"])
    xml = etree.tostring(
        root,
        encoding="UTF-8",
        xml_declaration=True,
        pretty_print=True,
    )
    validate_submission_xml(xml)
    return xml.decode("utf-8")


def build_cancellation_xml(data: dict) -> str:
    root = etree.Element(
        etree.QName(NS_LR, "RegFactuSistemaFacturacion"),
        nsmap={"sum": NS_LR, "sum1": NS_INFO, "ds": NS_DS},
    )
    header = _element(root, NS_LR, "Cabecera")
    obliged = _element(header, NS_INFO, "ObligadoEmision")
    _party(obliged, data["issuer_name"], data["issuer_tax_id"])

    wrapper = _element(root, NS_LR, "RegistroFactura")
    record = _element(wrapper, NS_INFO, "RegistroAnulacion")
    _element(record, NS_INFO, "IDVersion", "1.0")
    invoice_id = _element(record, NS_INFO, "IDFactura")
    _element(
        invoice_id,
        NS_INFO,
        "IDEmisorFacturaAnulada",
        data["issuer_tax_id"],
    )
    _element(
        invoice_id,
        NS_INFO,
        "NumSerieFacturaAnulada",
        data["invoice_number"],
    )
    _element(
        invoice_id,
        NS_INFO,
        "FechaExpedicionFacturaAnulada",
        data["issue_date"],
    )
    _element(record, NS_INFO, "RefExterna", data["external_reference"])
    _chain(record, data)
    _system(record, data)
    _element(record, NS_INFO, "FechaHoraHusoGenRegistro", data["generated_at"])
    _element(record, NS_INFO, "TipoHuella", "01")
    _element(record, NS_INFO, "Huella", data["record_hash"])
    xml = etree.tostring(
        root,
        encoding="UTF-8",
        xml_declaration=True,
        pretty_print=True,
    )
    validate_submission_xml(xml)
    return xml.decode("utf-8")


def validate_submission_xml(xml: bytes | str) -> None:
    parser = etree.XMLParser(
        resolve_entities=False,
        no_network=True,
        remove_blank_text=True,
    )
    parser.resolvers.add(_LocalSchemaResolver())
    schema_document = etree.parse(
        str(SCHEMA_DIRECTORY / "SuministroLR.xsd"),
        parser,
    )
    schema = etree.XMLSchema(schema_document)
    document = etree.fromstring(
        xml.encode("utf-8") if isinstance(xml, str) else xml,
        parser,
    )
    schema.assertValid(document)


def build_soap_envelope(submission_xml: str) -> bytes:
    parser = etree.XMLParser(resolve_entities=False, no_network=True)
    submission = etree.fromstring(submission_xml.encode("utf-8"), parser)
    envelope = etree.Element(
        etree.QName(NS_SOAP, "Envelope"),
        nsmap={"soapenv": NS_SOAP},
    )
    etree.SubElement(envelope, etree.QName(NS_SOAP, "Header"))
    body = etree.SubElement(envelope, etree.QName(NS_SOAP, "Body"))
    body.append(submission)
    return etree.tostring(envelope, encoding="UTF-8", xml_declaration=True)


def build_qr_url(
    *,
    issuer_tax_id: str,
    invoice_number: str,
    issue_date: str,
    total_amount: str,
) -> str:
    if settings.VERIFACTU_ENVIRONMENT == "production":
        base = (
            "https://www2.agenciatributaria.gob.es/wlpl/"
            "TIKE-CONT/ValidarQR"
        )
    else:
        base = "https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR"
    return f"{base}?{urlencode({
        'nif': issuer_tax_id,
        'numserie': invoice_number,
        'fecha': issue_date,
        'importe': total_amount,
    })}"
