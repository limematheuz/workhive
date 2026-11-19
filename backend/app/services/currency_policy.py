from contextlib import contextmanager
from datetime import datetime,timezone,date
from decimal import Decimal,ROUND_HALF_UP,InvalidOperation
from pathlib import Path
import json
from fastapi import HTTPException
from app.services.estimator_cost_policy import money,ZERO

CODES=frozenset(json.loads((Path(__file__).resolve().parents[1]/"data"/"currency_codes.json").read_text(encoding="utf-8")))
MINOR_UNITS=json.loads((Path(__file__).resolve().parents[1]/"data"/"currency_minor_units.json").read_text(encoding="utf-8"))


def native_money(value,currency):
    try:
        parsed=Decimal(str(value))
        if not parsed.is_finite():raise InvalidOperation()
        return parsed.quantize(Decimal(10)**-MINOR_UNITS[currency],rounding=ROUND_HALF_UP)
    except (InvalidOperation,ValueError):raise HTTPException(422,"El importe original supera la precisión admitida.")


def validate_amount(value,currency):
    if native_money(value,currency)!=Decimal(str(value)):raise HTTPException(422,"El importe original supera los decimales de la moneda seleccionada.")


KINDS={"invoices":"invoice","expenses":"expense","payments":"payment","sales":"sale"}


def validate(spec,at):
    if spec.currency not in CODES:raise HTTPException(422,"Selecciona una moneda reconocida.")
    if spec.currency=="EUR" and spec.eur_rate!=1:raise HTTPException(422,"La equivalencia de EUR debe ser 1.")
    at=at.astimezone(timezone.utc).date() if isinstance(at,datetime) and at.tzinfo else at.date() if isinstance(at,datetime) else at
    if spec.rate_date>date.today() or spec.rate_date>at:raise HTTPException(422,"La fecha del cambio debe ser real y no posterior a la operación.")
    if not 2000<=spec.rate_date.year<=9998:raise HTTPException(422,"Indica una fecha de cambio válida.")


def converted(value,spec,places=".01"):
    try:
        parsed=Decimal(str(value))
        if not parsed.is_finite():raise InvalidOperation()
        amount=(parsed*spec.eur_rate).quantize(Decimal(places),rounding=ROUND_HALF_UP)
    except (InvalidOperation,ValueError):raise HTTPException(422,"El importe convertido supera la precisión admitida.")
    if abs(amount)>Decimal("9999999999.99"):raise HTTPException(422,"La equivalencia en EUR supera el máximo admitido.")
    return amount


def snapshot(spec,native,original,eur,user):
    return dict(schema_version=1,currency=spec.currency,eur_rate=str(spec.eur_rate),rate_date=spec.rate_date.isoformat(),
        source="manual_verified",verified_by=user.id,verified_at=datetime.now(timezone.utc).isoformat(),
        original_amounts={key:str(value) for key,value in original.items()},eur_amounts={key:str(value) for key,value in eur.items()},
        original_document=native.model_dump(mode="json"),rounding_difference_eur=str(money(Decimal(str(eur["total_amount"]))-converted(original["total_amount"],spec))))


@contextmanager
def writing(db):
    previous=db.info.get("currency_write",False);db.info["currency_write"]=True
    try:yield
    finally:
        if previous:db.info["currency_write"]=previous
        else:db.info.pop("currency_write",None)


def invoice_amounts(data,currency):
    for value in (data.discount,data.equivalence_surcharge,data.retention):
        if Decimal(str(value)).quantize(Decimal(".0001"))!=Decimal(str(value)):raise HTTPException(422,"Los porcentajes del documento admiten un máximo de cuatro decimales.")
    for item in data.items:
        if Decimal(str(item.tax_rate)).quantize(Decimal(".000001"))!=Decimal(str(item.tax_rate)):raise HTTPException(422,"El tipo impositivo admite un máximo de seis decimales.")
    rows=[];subtotal=ZERO;tax=ZERO
    discount=1-Decimal(str(data.discount))/100
    for item in data.items:
        base=native_money(Decimal(str(item.quantity))*Decimal(str(item.unit_price)),currency)
        total=native_money(base*(1+Decimal(str(item.tax_rate))),currency)
        rows.append(dict(description=item.description,quantity=str(item.quantity),unit_price=str(item.unit_price),tax_rate=str(item.tax_rate),subtotal=str(base),total=str(total)))
        subtotal+=base;tax+=base*discount*Decimal(str(item.tax_rate))
    base=native_money(subtotal*discount,currency);tax=native_money(tax,currency)
    surcharge=native_money(base*Decimal(str(data.equivalence_surcharge))/100,currency);retention=native_money(base*Decimal(str(data.retention))/100,currency)
    return dict(base_amount=base,tax_amount=tax+surcharge,total_amount=native_money(base+tax+surcharge-retention,currency)),rows


def invoice_items(data,spec,native_lines):
    from app.schemas.invoice_item import InvoiceItemCreate
    from app.repositories.invoice_item import calculate_item_amounts
    result=[]
    for item,line in zip(data.items,native_lines,strict=True):
        price=converted(item.unit_price,spec,".0001");quantity=item.quantity;description=item.description
        subtotal=calculate_item_amounts(quantity,price,item.tax_rate)[0]
        expected=converted(line["subtotal"],spec)
        if subtotal!=expected or Decimal(str(quantity)).quantize(Decimal(".0001"))!=Decimal(str(quantity)):
            if item.task_item_id is not None:raise HTTPException(422,"La precisión del precio convertido no permite conservar la cantidad del trabajo acordado. Revisa la moneda y la escala de la línea.")
            quantity=1;price=expected
            q=format(Decimal(str(item.quantity)),"f");p=format(Decimal(str(item.unit_price)),"f")
            description=item.description[:300]+f" · Equivalencia contable de {q} × {p} {spec.currency}"
        result.append(InvoiceItemCreate(**{**item.model_dump(),"quantity":quantity,"unit_price":float(price),"description":description}))
    return result
