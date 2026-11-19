"""Portable, parameterized text matching and small scalar result windows."""
from dataclasses import dataclass
from datetime import datetime
import unicodedata
from sqlalchemy import String, case, cast, func, or_


@dataclass(frozen=True)
class Hit:
    id: int
    title: str
    context: str
    status: str | None
    reference: str | None = None
    occurred_at: datetime | None = None


def normalize(value: str) -> str:
    return " ".join("".join(char for char in unicodedata.normalize("NFKD", value.casefold())
        if not unicodedata.combining(char)).split())


def escaped(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def folded(column):
    expression = func.lower(func.coalesce(cast(column, String), ""))
    for source, target in (("á", "a"), ("Á", "a"), ("é", "e"), ("É", "e"),
            ("í", "i"), ("Í", "i"), ("ó", "o"), ("Ó", "o"), ("ú", "u"),
            ("Ú", "u"), ("ü", "u"), ("Ü", "u"), ("ñ", "n"), ("Ñ", "n")):
        expression = func.replace(expression, source, target)
    return expression


def window(query, term, fields, *, identifier, title, limit, reference=None, date=None):
    pattern = "%" + escaped(term) + "%"
    matching = [folded(column).like(pattern, escape="\\") for column in fields]
    numeric = term.lstrip("#")
    if numeric.isdecimal() and len(numeric) <= 18:
        matching.append(identifier == int(numeric))
    ranking = []
    if reference is not None:
        ranking.append((folded(reference) == term, 0))
    ranking.extend([(folded(title) == term, 1),
        (folded(title).like(escaped(term) + "%", escape="\\"), 2)])
    ordered = [case(*ranking, else_=3)]
    if date is not None:
        ordered.append(date.desc())
    ordered.append(identifier.desc())
    return query.filter(or_(*matching)).order_by(*ordered).limit(limit + 1).all()


def context(*parts):
    return " · ".join(str(part) for part in parts if part)
