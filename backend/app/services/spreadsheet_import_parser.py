import csv
from itertools import islice
from io import BytesIO,StringIO
from zipfile import ZipFile,BadZipFile
from defusedxml import ElementTree
from defusedxml.common import DefusedXmlException
from fastapi import HTTPException

NS={"s":"http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
ALIASES={"nombre":"name","cargo":"position","equipo":"team","horas_mes":"monthly_hours","coste_hora":"hourly_cost",
         "direccion":"address","dirección":"address","ciudad":"city","codigo_postal":"postal_code","código_postal":"postal_code",
         "pais":"country","país":"country","correo":"email","telefono":"phone","teléfono":"phone","nif":"legal_number", "cliente":"client_name", "ubicación":"location_name", "ubicacion":"location_name", "centro":"location_name", "servicio":"service_name", "trabajador":"employee_name", "trabajadores":"employee_name", "equipo_trabajo":"crew_name", "titulo":"title", "título":"title", "inicio":"scheduled_start_at", "duracion_minutos":"duration_minutes", "duración_minutos":"duration_minutes", "tareas":"tasks", "instrucciones":"instructions", "precio":"price"}


def xml(archive,name):
    raw=archive.read(name)
    if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise ValueError("El archivo contiene instrucciones XML no admitidas.")
    return ElementTree.fromstring(raw, forbid_dtd=True, forbid_entities=True, forbid_external=True)


def xlsx_rows(content):
    with ZipFile(BytesIO(content)) as archive:
        if len(archive.infolist())>2000 or sum(info.file_size for info in archive.infolist())>20_000_000:
            raise ValueError("El libro es demasiado grande.")
        strings=[]
        if "xl/sharedStrings.xml" in archive.namelist():
            strings=["".join(item.itertext()) for item in xml(archive,"xl/sharedStrings.xml").findall("s:si",NS)]
        sheet_name="xl/worksheets/sheet1.xml"
        if "xl/workbook.xml" in archive.namelist():
            workbook=xml(archive,"xl/workbook.xml")
            first=workbook.find("s:sheets/s:sheet",NS)
            if first is None:raise ValueError("El libro no contiene hojas.")
            relation=first.attrib.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            relationships=xml(archive,"xl/_rels/workbook.xml.rels")
            target=next((r.attrib.get("Target","") for r in relationships if r.attrib.get("Id")==relation and r.attrib.get("TargetMode")!="External"),"")
            from posixpath import normpath
            sheet_name=normpath(target.lstrip("/") if target.startswith("/") else "xl/"+target)
            if not sheet_name.startswith("xl/worksheets/") or not sheet_name.endswith(".xml"):
                raise ValueError("La primera hoja del libro no es una tabla de datos.")
        sheet=xml(archive,sheet_name)
        rows=[]
        for row in sheet.findall("s:sheetData/s:row",NS):
            cells={}
            for cell in row.findall("s:c",NS):
                if cell.find("s:f",NS) is not None and cell.find("s:v",NS) is None:
                    raise ValueError("Guarda los resultados de las fórmulas antes de importar.")
                ref=cell.attrib.get("r","")
                letters="".join(c for c in ref if c.isalpha())
                index=0
                for char in letters:index=index*26+ord(char.upper())-64
                if not 1<=index<=100:raise ValueError("La hoja admite un máximo de 100 columnas.")
                value=cell.findtext("s:v",default="",namespaces=NS)
                if cell.attrib.get("t")=="s":value=strings[int(value)]
                if cell.attrib.get("t")=="inlineStr":value="".join(cell.find("s:is",NS).itertext())
                cells[index-1]=value
            if cells:rows.append([cells.get(i,"") for i in range(max(cells)+1)])
            if len(rows)>501:raise ValueError("Importa un máximo de 500 filas cada vez.")
        return rows


def parse(content,filename):
    if len(content)>2_000_000:raise HTTPException(413,"El archivo supera 2 MB.")
    try:
        if filename.lower().endswith(".xlsx"):
            rows=xlsx_rows(content)
        elif filename.lower().endswith(".csv"):
            try:
                text=content.decode("utf-8-sig")
            except UnicodeDecodeError:
                text=content.decode("cp1252")
            dialect=csv.Sniffer().sniff(text[:4096],delimiters=",;	")
            rows=list(islice(csv.reader(StringIO(text),dialect),502))
        else:raise ValueError("Selecciona un archivo XLSX o CSV.")
        if not 2<=len(rows)<=501:raise ValueError("El archivo debe contener cabecera y entre 1 y 500 filas.")
        header=[ALIASES.get(value.strip().lower(),value.strip().lower()) for value in rows[0]]
        if len(set(header))!=len(header):raise ValueError("Las cabeceras están duplicadas.")
        return [{key:row[i].strip() if i<len(row) else "" for i,key in enumerate(header)} for row in rows[1:] if any(row)]
    except (ValueError,KeyError,IndexError,BadZipFile,UnicodeError,ElementTree.ParseError,DefusedXmlException,csv.Error) as exc:
        raise HTTPException(422,str(exc)) from exc
