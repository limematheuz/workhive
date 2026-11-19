from copy import deepcopy
from decimal import Decimal
from xml.sax.saxutils import escape
from reportlab.platypus import Paragraph
from app.services.currency_policy import writing


def pdf_block(invoice,style):
    snapshot=getattr(invoice,"currency_snapshot",None)
    if not snapshot or snapshot.get("currency")=="EUR":return []
    native=snapshot["original_amounts"];eur=snapshot["eur_amounts"];code=escape(snapshot["currency"])
    text=f"<b>Moneda original: {code}</b><br/>Importe original: {escape(native['total_amount'])} {code}"
    if "base_amount" in native:text+=f" · Base: {escape(native['base_amount'])} {code} · Impuestos: {escape(native['tax_amount'])} {code}"
    text+=f"<br/>Cambio manual verificado ({escape(snapshot['rate_date'])}): 1 {code} = {escape(snapshot['eur_rate'])} EUR."
    text+=f"<br/>Equivalencia contable total: {escape(eur['total_amount'])} EUR. Las líneas y los importes fiscales del documento están expresados en EUR."
    if Decimal(snapshot.get("rounding_difference_eur","0")):text+=f"<br/>Ajuste de redondeo por líneas en EUR: {escape(snapshot['rounding_difference_eur'])} EUR."
    return [Paragraph(text,style)]


def inherit_rectification(db,original,rectification):
    source=original.currency_snapshot
    if not source:return
    snapshot=deepcopy(source)
    snapshot["rectification_of"]=original.id
    for key in ("original_amounts","eur_amounts"):
        snapshot[key]={name:str(-Decimal(str(value))) for name,value in snapshot[key].items()}
    snapshot["rounding_difference_eur"]=str(-Decimal(snapshot.get("rounding_difference_eur","0")))
    snapshot["original_document"]["issue_date"]=rectification.issue_date.isoformat()
    for item in snapshot.get("original_document",{}).get("items",[]):item["unit_price"]=-item["unit_price"]
    for item in snapshot.get("original_lines",[]):
        for key in ("unit_price","subtotal","total"):item[key]=str(-Decimal(item[key]))
    with writing(db):
        rectification.currency_snapshot=snapshot
        db.flush()
