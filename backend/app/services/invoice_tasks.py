from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.company import Company
from app.models.location import Location
from app.models.reservation import Reservation
from app.models.task_item import TaskItem
from app.repositories import client as client_repo
from app.schemas.task_item import InvoiceableTaskResponse, TaskItemResponse
from app.services.company_client_service import ensure_company_as_client


def _resolve_invoice_client_for_task(
    db: Session,
    company_id: int,
    task: TaskItem,
) -> tuple[Client | None, str, Company | None]:
    checkout_reservation = task.checkout_reservation
    if (
        checkout_reservation
        and checkout_reservation.owner_company_id
        and checkout_reservation.owner_company_id != company_id
    ):
        issuer = (
            db.query(Company)
            .filter(Company.id == checkout_reservation.owner_company_id)
            .first()
        )
        if not issuer:
            return None, "external", None
        return (
            ensure_company_as_client(
                db,
                owner_company_id=company_id,
                partner_company=issuer,
            ),
            "external",
            issuer,
        )

    location = task.location
    if location and location.client_id:
        return (
            client_repo.get_client_by_id(
                db,
                location.client_id,
                company_id,
            ),
            "own",
            None,
        )
    return None, "own", None


def get_invoiceable_completed_tasks(
    db: Session,
    company_id: int,
) -> list[InvoiceableTaskResponse]:
    tasks = (
        db.query(TaskItem)
        .join(Location, TaskItem.location_id == Location.id)
        .outerjoin(
            Reservation,
            TaskItem.checkout_reservation_id == Reservation.id,
        )
        .filter(
            TaskItem.company_id == company_id,
            TaskItem.status == "completed",
            TaskItem.is_invoiced.is_(False),
        )
        .order_by(
            TaskItem.date_done.desc().nullslast(),
            TaskItem.created_at.desc(),
        )
        .all()
    )

    responses: list[InvoiceableTaskResponse] = []
    for task in tasks:
        client, billing_source, collaborator = _resolve_invoice_client_for_task(
            db,
            company_id,
            task,
        )
        if client is None:
            continue
        base = TaskItemResponse.model_validate(task)
        responses.append(
            InvoiceableTaskResponse(
                **base.model_dump(),
                client_id=client.id,
                client_name=client.name,
                location_name=(
                    task.location.name
                    if task.location
                    else f"#{task.location_id}"
                ),
                billing_source=billing_source,
                collaborator_company_id=(
                    collaborator.id if collaborator else None
                ),
                collaborator_company_name=(
                    collaborator.name if collaborator else None
                ),
            )
        )
    # Collaborating issuers are materialized as real Client rows while
    # resolving invoiceable work. `flush()` assigns the ID but does not persist
    # it across requests, so this endpoint must commit the synchronized client.
    db.commit()
    return responses
