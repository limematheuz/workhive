"""Global erasure must preserve administration in every related company."""

from datetime import datetime, timezone
from fastapi import HTTPException
from app.repositories.privacy_administration import lock_administrations


def primary_company_to_close(db, user):
    companies, administrators = lock_administrations(db, user, datetime.now(timezone.utc))
    primary = None
    for company in companies:
        if not company.is_active or administrators[company.id] != {user.id}:
            continue
        if company.id != user.company_id:
            raise HTTPException(409, "Esta identidad es la última administradora de otra empresa. Asigna antes otra persona administradora en esa empresa para completar la supresión global.")
        primary = company
    return primary
