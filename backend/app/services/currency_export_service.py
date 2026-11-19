import csv,io
from app.repositories import transaction_currency as repo
from app.services.accountant_export_service import _safe_spreadsheet_text


def csv_export(db,company,start,end):
    output=io.StringIO();writer=csv.writer(output,delimiter=";")
    writer.writerow(["Tipo","ID","Estado","Moneda original","Cambio a EUR","Fecha cambio","Importe original","Importe EUR","Diferencia cambio EUR"])
    count=0
    for kind,model in repo.MODELS.items():
        for row in repo.period_records(db,company,kind,start,end):
            count+=1
            snapshot=row.currency_snapshot
            writer.writerow([kind,row.id,getattr(row,"status",None) or ("active" if row.is_active else "deleted"),_safe_spreadsheet_text(snapshot["currency"]),snapshot["eur_rate"],snapshot["rate_date"],
                snapshot["original_amounts"]["total_amount"],snapshot["eur_amounts"]["total_amount"],snapshot.get("realized_exchange_difference_eur","0")])
    return output.getvalue().encode("utf-8-sig") if count else None
