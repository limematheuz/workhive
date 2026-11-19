from io import BytesIO
from zipfile import ZipFile
import pytest
from fastapi import HTTPException
from app.services.spreadsheet_import_parser import parse


def workbook(sheet):
    stream=BytesIO()
    with ZipFile(stream,"w") as archive:archive.writestr("xl/worksheets/sheet1.xml",sheet)
    return stream.getvalue()


def test_xlsx_reads_saved_formula_result_without_evaluating():
    data=workbook('''<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row><c r="A1" t="inlineStr"><is><t>nombre</t></is></c><c r="B1" t="inlineStr"><is><t>coste_hora</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>Lucía</t></is></c><c r="B2"><f>10+5</f><v>15</v></c></row></sheetData></worksheet>''')
    assert parse(data,"personal.xlsx")==[{"name":"Lucía","hourly_cost":"15"}]


def test_xlsx_rejects_entities():
    data=workbook('''<!DOCTYPE worksheet [<!ENTITY xxe SYSTEM "file:///never-read">]><worksheet>&xxe;</worksheet>''')
    with pytest.raises(HTTPException) as error:parse(data,"personal.xlsx")
    assert error.value.status_code==422


def test_windows_csv_preserves_names():
    assert parse("nombre;cargo\nLucía;Limpieza\n".encode("cp1252"),"personal.csv")[0]["name"]=="Lucía"
