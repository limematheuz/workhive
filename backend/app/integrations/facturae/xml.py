from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from lxml import etree

from app.models.invoice import Invoice


NS_FACTURAE = (
    "http://www.facturae.gob.es/formato/Versiones/Facturaev3_2_2.xml"
)
NS_DS = "http://www.w3.org/2000/09/xmldsig#"
SCHEMA_DIRECTORY = Path(__file__).with_name("schemas")
MONEY = Decimal("0.01")
RECTIFICATION_REASONS = {
    "01": "Número de la factura",
    "02": "Serie de la factura",
    "03": "Fecha expedición",
    "04": "Nombre y apellidos/Razón Social-Emisor",
    "05": "Nombre y apellidos/Razón Social-Receptor",
    "06": "Identificación fiscal Emisor/obligado",
    "07": "Identificación fiscal Receptor",
    "08": "Domicilio Emisor/Obligado",
    "09": "Domicilio Receptor",
    "10": "Detalle Operación",
    "11": "Porcentaje impositivo a aplicar",
    "12": "Cuota tributaria a aplicar",
    "13": "Fecha/Periodo a aplicar",
    "14": "Clase de factura",
    "15": "Literales legales",
    "16": "Base imponible",
    "80": "Cálculo de cuotas repercutidas",
    "81": "Cálculo de cuotas retenidas",
    "82": "Base imponible modificada por devolución de envases / embalajes",
    "83": "Base imponible modificada por descuentos y bonificaciones",
    "84": "Base imponible modificada por resolución firme, judicial o administrativa",
    "85": (
        "Base imponible modificada cuotas repercutidas no satisfechas. "
        "Auto de declaración de concurso"
    ),
}


class _LocalSchemaResolver(etree.Resolver):
    def resolve(self, url, public_id, context):
        filename = url.rsplit("/", 1)[-1]
        local = SCHEMA_DIRECTORY / filename
        if local.is_file():
            return self.resolve_filename(str(local), context)
        return None


def _element(parent, name: str, value=None):
    child = etree.SubElement(parent, name)
    if value is not None:
        child.text = str(value)
    return child


def _decimal(value: object) -> Decimal:
    return Decimal(str(value or 0))


def _money(value: object) -> str:
    return f"{_decimal(value).quantize(MONEY, rounding=ROUND_HALF_UP):f}"


def _number(value: object) -> str:
    normalized = f"{_decimal(value):f}".rstrip("0").rstrip(".")
    return normalized or "0"


def _amount(parent, name: str, value: object) -> None:
    amount = _element(parent, name)
    _element(amount, "TotalAmount", _money(value))


def _tax(parent, *, rate: Decimal, base: Decimal, amount: Decimal) -> None:
    tax = _element(parent, "Tax")
    _element(tax, "TaxTypeCode", "01")
    _element(tax, "TaxRate", _number(rate * Decimal("100")))
    taxable = _element(tax, "TaxableBase")
    _element(taxable, "TotalAmount", _money(base))
    tax_amount = _element(tax, "TaxAmount")
    _element(tax_amount, "TotalAmount", _money(amount))


def _split_person_name(value: str) -> tuple[str, str, str | None]:
    parts = value.split()
    if len(parts) == 1:
        return parts[0], "Sin apellido", None
    if len(parts) == 2:
        return parts[0], parts[1], None
    return " ".join(parts[:-2]), parts[-2], parts[-1]


def _address_in_spain(parent, data: dict) -> None:
    address = _element(parent, "AddressInSpain")
    _element(address, "Address", str(data["address"])[:80])
    _element(address, "PostCode", data["postal_code"])
    _element(address, "Town", str(data["city"])[:50])
    _element(address, "Province", str(data["province"])[:20])
    _element(address, "CountryCode", "ESP")


def _contact(parent, data: dict) -> None:
    phone = data.get("phone")
    email = data.get("email")
    if not phone and not email:
        return
    contact = _element(parent, "ContactDetails")
    if phone:
        _element(contact, "Telephone", str(phone)[:15])
    if email:
        _element(contact, "ElectronicMail", str(email)[:60])


def _party(parent, tag: str, data: dict, *, legal_entity: bool) -> None:
    party = _element(parent, tag)
    identification = _element(party, "TaxIdentification")
    _element(
        identification,
        "PersonTypeCode",
        "J" if legal_entity else "F",
    )
    _element(identification, "ResidenceTypeCode", "R")
    _element(identification, "TaxIdentificationNumber", data["tax_id"])
    if legal_entity:
        entity = _element(party, "LegalEntity")
        _element(entity, "CorporateName", str(data["name"])[:80])
        _address_in_spain(entity, data)
        _contact(entity, data)
    else:
        individual = _element(party, "Individual")
        name, first_surname, second_surname = _split_person_name(data["name"])
        _element(individual, "Name", name[:40])
        _element(individual, "FirstSurname", first_surname[:40])
        if second_surname:
            _element(individual, "SecondSurname", second_surname[:40])
        _address_in_spain(individual, data)
        _contact(individual, data)


def _validate_party(data: dict, label: str) -> None:
    missing = [
        field
        for field in ("name", "tax_id", "address", "postal_code", "city", "province")
        if not data.get(field)
    ]
    if missing:
        raise ValueError(
            f"Facturae requires {label} fields: {', '.join(missing)}"
        )
    if len(str(data["postal_code"])) != 5 or not str(data["postal_code"]).isdigit():
        raise ValueError(f"Facturae requires a 5-digit {label} postal code")


def _tax_groups(invoice: Invoice) -> list[tuple[Decimal, Decimal, Decimal]]:
    discount = _decimal(invoice.discount) / Decimal("100")
    bases: dict[Decimal, Decimal] = defaultdict(Decimal)
    for item in invoice.items:
        rate = _decimal(item.tax_rate)
        bases[rate] += _decimal(item.subtotal) * (Decimal("1") - discount)
    return [
        (
            rate,
            base.quantize(MONEY, rounding=ROUND_HALF_UP),
            (base * rate).quantize(MONEY, rounding=ROUND_HALF_UP),
        )
        for rate, base in sorted(bases.items())
    ]


def _invoice_parties(invoice: Invoice) -> tuple[dict, dict]:
    company = invoice.company
    client = invoice.client
    seller = {
        "name": company.name,
        "tax_id": company.tax_id,
        "address": company.address,
        "postal_code": company.postal_code,
        "city": company.city,
        "province": company.province,
        "phone": company.phone,
        "email": company.email,
    }
    buyer = {
        "name": client.name,
        "tax_id": client.legal_number,
        "address": client.address,
        "postal_code": client.postal_code,
        "city": client.city,
        "province": client.province or client.city,
        "phone": client.phone,
        "email": client.email,
        "legal_entity": client.client_type != "individual",
    }
    _validate_party(seller, "seller")
    _validate_party(buyer, "buyer")
    return seller, buyer


def build_facturae_xml(invoice: Invoice) -> bytes:
    if invoice.status not in {"issued", "paid", "overdue", "rectified"}:
        raise ValueError("Facturae can only be generated for issued invoices")
    seller, buyer = _invoice_parties(invoice)
    root = etree.Element(
        etree.QName(NS_FACTURAE, "Facturae"),
        nsmap={"fe": NS_FACTURAE, "ds": NS_DS},
    )

    header = _element(root, "FileHeader")
    _element(header, "SchemaVersion", "3.2.2")
    _element(header, "Modality", "I")
    _element(header, "InvoiceIssuerType", "EM")
    batch = _element(header, "Batch")
    _element(
        batch,
        "BatchIdentifier",
        f"{seller['tax_id']}{invoice.invoice_number}"[:70],
    )
    _element(batch, "InvoicesCount", "1")
    _amount(batch, "TotalInvoicesAmount", invoice.total_amount)
    _amount(batch, "TotalOutstandingAmount", invoice.total_amount)
    _amount(batch, "TotalExecutableAmount", invoice.total_amount)
    _element(batch, "InvoiceCurrencyCode", "EUR")

    parties = _element(root, "Parties")
    _party(parties, "SellerParty", seller, legal_entity=True)
    _party(
        parties,
        "BuyerParty",
        buyer,
        legal_entity=buyer["legal_entity"],
    )

    invoices = _element(root, "Invoices")
    invoice_node = _element(invoices, "Invoice")
    invoice_header = _element(invoice_node, "InvoiceHeader")
    _element(invoice_header, "InvoiceNumber", invoice.invoice_number[:20])
    _element(invoice_header, "InvoiceDocumentType", "FC")
    _element(
        invoice_header,
        "InvoiceClass",
        "OR" if invoice.is_rectification else "OO",
    )
    if invoice.is_rectification:
        if not invoice.original_invoice_id:
            raise ValueError("Rectifying Facturae requires the original invoice")
        original = invoice.original_invoice
        corrective = _element(invoice_header, "Corrective")
        _element(corrective, "InvoiceNumber", original.invoice_number[:20])
        reason_code = invoice.rectification_reason_code or "10"
        if reason_code not in RECTIFICATION_REASONS:
            raise ValueError("Facturae rectification reason code is invalid")
        _element(corrective, "ReasonCode", reason_code)
        _element(
            corrective,
            "ReasonDescription",
            RECTIFICATION_REASONS[reason_code],
        )
        tax_period = _element(corrective, "TaxPeriod")
        _element(tax_period, "StartDate", original.issue_date.date().isoformat())
        _element(tax_period, "EndDate", original.issue_date.date().isoformat())
        _element(corrective, "CorrectionMethod", "02")
        _element(
            corrective,
            "CorrectionMethodDescription",
            "Rectificación por diferencias",
        )
        _element(
            corrective,
            "AdditionalReasonDescription",
            (invoice.rectification_reason or "Rectificación")[:2500],
        )
        _element(
            corrective,
            "InvoiceIssueDate",
            original.issue_date.date().isoformat(),
        )

    issue_data = _element(invoice_node, "InvoiceIssueData")
    _element(issue_data, "IssueDate", invoice.issue_date.date().isoformat())
    _element(issue_data, "InvoiceCurrencyCode", "EUR")
    _element(issue_data, "TaxCurrencyCode", "EUR")
    _element(issue_data, "LanguageName", "es")
    _element(
        issue_data,
        "InvoiceDescription",
        "; ".join(item.description for item in invoice.items)[:2500],
    )

    taxes_output = _element(invoice_node, "TaxesOutputs")
    for rate, base, tax in _tax_groups(invoice):
        _tax(taxes_output, rate=rate, base=base, amount=tax)

    retention_amount = (
        _decimal(invoice.base_amount)
        * _decimal(invoice.retention)
        / Decimal("100")
    ).quantize(MONEY, rounding=ROUND_HALF_UP)
    if retention_amount:
        withheld = _element(invoice_node, "TaxesWithheld")
        tax = _element(withheld, "Tax")
        _element(tax, "TaxTypeCode", "04")
        _element(tax, "TaxRate", _number(invoice.retention))
        taxable = _element(tax, "TaxableBase")
        _element(taxable, "TotalAmount", _money(invoice.base_amount))
        amount = _element(tax, "TaxAmount")
        _element(amount, "TotalAmount", _money(retention_amount))

    gross_total = sum(
        (_decimal(item.subtotal) for item in invoice.items),
        Decimal("0"),
    )
    discount_amount = (
        gross_total * _decimal(invoice.discount) / Decimal("100")
    ).quantize(MONEY, rounding=ROUND_HALF_UP)
    totals = _element(invoice_node, "InvoiceTotals")
    _element(totals, "TotalGrossAmount", _money(gross_total))
    if discount_amount:
        discounts = _element(totals, "GeneralDiscounts")
        discount = _element(discounts, "Discount")
        _element(discount, "DiscountReason", "Descuento general")
        _element(discount, "DiscountRate", _number(invoice.discount))
        _element(discount, "DiscountAmount", _money(discount_amount))
        _element(totals, "TotalGeneralDiscounts", _money(discount_amount))
    _element(totals, "TotalGrossAmountBeforeTaxes", _money(invoice.base_amount))
    _element(totals, "TotalTaxOutputs", _money(invoice.tax_amount))
    _element(totals, "TotalTaxesWithheld", _money(retention_amount))
    _element(totals, "InvoiceTotal", _money(invoice.total_amount))
    _element(totals, "TotalOutstandingAmount", _money(invoice.total_amount))
    _element(totals, "TotalExecutableAmount", _money(invoice.total_amount))

    items = _element(invoice_node, "Items")
    discount_factor = Decimal("1") - _decimal(invoice.discount) / Decimal("100")
    for item in invoice.items:
        line = _element(items, "InvoiceLine")
        _element(line, "ItemDescription", item.description[:2500])
        _element(line, "Quantity", _number(item.quantity))
        _element(line, "UnitOfMeasure", "01")
        _element(line, "UnitPriceWithoutTax", _number(item.unit_price))
        _element(line, "TotalCost", _money(item.subtotal))
        _element(line, "GrossAmount", _money(item.subtotal))
        line_taxes = _element(line, "TaxesOutputs")
        line_base = (
            _decimal(item.subtotal) * discount_factor
        ).quantize(MONEY, rounding=ROUND_HALF_UP)
        line_tax = (
            line_base * _decimal(item.tax_rate)
        ).quantize(MONEY, rounding=ROUND_HALF_UP)
        _tax(
            line_taxes,
            rate=_decimal(item.tax_rate),
            base=line_base,
            amount=line_tax,
        )

    if invoice.due_date:
        payments = _element(invoice_node, "PaymentDetails")
        installment = _element(payments, "Installment")
        _element(
            installment,
            "InstallmentDueDate",
            invoice.due_date.date().isoformat(),
        )
        _element(installment, "InstallmentAmount", _money(invoice.total_amount))
        bank_account = seller.get("bank_account") or invoice.company.bank_account
        _element(installment, "PaymentMeans", "04" if bank_account else "01")
        if bank_account:
            account = _element(installment, "AccountToBeCredited")
            _element(account, "IBAN", str(bank_account).replace(" ", ""))

    if invoice.notes or invoice.terms:
        additional = _element(invoice_node, "AdditionalData")
        _element(
            additional,
            "InvoiceAdditionalInformation",
            "\n".join(
                value for value in (invoice.notes, invoice.terms) if value
            )[:2500],
        )

    xml = etree.tostring(
        root,
        encoding="UTF-8",
        xml_declaration=True,
        pretty_print=True,
    )
    validate_facturae_xml(xml)
    return xml


def validate_facturae_xml(xml: bytes | str) -> None:
    parser = etree.XMLParser(
        resolve_entities=False,
        no_network=True,
        remove_blank_text=True,
    )
    parser.resolvers.add(_LocalSchemaResolver())
    schema = etree.XMLSchema(
        etree.parse(str(SCHEMA_DIRECTORY / "Facturaev3_2_2.xsd"), parser)
    )
    document = etree.fromstring(
        xml.encode("utf-8") if isinstance(xml, str) else xml,
        parser,
    )
    schema.assertValid(document)
