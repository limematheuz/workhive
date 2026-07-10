import hashlib
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal


def _date(value: date | datetime | str) -> str:
    if isinstance(value, str):
        return value
    return value.strftime("%d-%m-%Y")


def _decimal(value: Decimal | float | int | str) -> str:
    amount = Decimal(str(value))
    return f"{amount.quantize(Decimal('0.01')):f}"


@dataclass(frozen=True)
class InvoiceHashInput:
    issuer_tax_id: str
    invoice_number: str
    issue_date: date | datetime | str
    invoice_type: str
    tax_amount: Decimal | float | int | str
    total_amount: Decimal | float | int | str
    previous_hash: str | None
    generated_at: datetime | str


@dataclass(frozen=True)
class CancellationHashInput:
    issuer_tax_id: str
    invoice_number: str
    issue_date: date | datetime | str
    previous_hash: str | None
    generated_at: datetime | str


def _timestamp(value: datetime | str) -> str:
    if isinstance(value, str):
        return value
    return value.isoformat(timespec="seconds")


def calculate_invoice_hash(data: InvoiceHashInput) -> str:
    source = "&".join(
        [
            f"IDEmisorFactura={data.issuer_tax_id.strip()}",
            f"NumSerieFactura={data.invoice_number.strip()}",
            f"FechaExpedicionFactura={_date(data.issue_date)}",
            f"TipoFactura={data.invoice_type.strip()}",
            f"CuotaTotal={_decimal(data.tax_amount)}",
            f"ImporteTotal={_decimal(data.total_amount)}",
            f"Huella={(data.previous_hash or '').strip()}",
            f"FechaHoraHusoGenRegistro={_timestamp(data.generated_at)}",
        ]
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest().upper()


def calculate_cancellation_hash(data: CancellationHashInput) -> str:
    source = "&".join(
        [
            f"IDEmisorFacturaAnulada={data.issuer_tax_id.strip()}",
            f"NumSerieFacturaAnulada={data.invoice_number.strip()}",
            f"FechaExpedicionFacturaAnulada={_date(data.issue_date)}",
            f"Huella={(data.previous_hash or '').strip()}",
            f"FechaHoraHusoGenRegistro={_timestamp(data.generated_at)}",
        ]
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest().upper()
