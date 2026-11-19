from fastapi import APIRouter, Depends, Query, Request, Response, status
from sqlalchemy.orm import Session
from app.api.deps import ActiveUser, ActiveClientPortal, ClientPortalPrincipal, get_db
from app.schemas.task_client_publication import PublishTaskPart, RevokeTaskPart, AcceptTaskPart, TaskPublicationCandidate, PublishedWork, PublishedWorkPage, WorkAcceptancePage
from app.services import task_client_publication_service as service, task_client_publication_pdf
from app.services import task_client_publication_content

router = APIRouter()


@router.get("/task-client-publications/tasks/{task_id}", response_model=TaskPublicationCandidate)
def candidate(task_id: int, db: Session = Depends(get_db), user=ActiveUser):
    return service.candidate(db, user, task_id)


@router.post("/task-client-publications/tasks/{task_id}", response_model=TaskPublicationCandidate, status_code=status.HTTP_201_CREATED)
def publish(task_id: int, payload: PublishTaskPart, request: Request, db: Session = Depends(get_db), user=ActiveUser):
    return service.publish(db, user, task_id, payload, request)


@router.post("/task-client-publications/tasks/{task_id}/revoke", response_model=TaskPublicationCandidate)
def revoke(task_id: int, payload: RevokeTaskPart, request: Request, db: Session = Depends(get_db), user=ActiveUser):
    return service.revoke(db, user, task_id, payload, request)


@router.get("/task-client-publications/tasks/{task_id}/photos/{photo_id}")
def manager_photo(task_id: int, photo_id: str, db: Session = Depends(get_db), user=ActiveUser):
    publication = service.manager_part(db, user, task_id)
    stored = service.publication_photo(db, publication, photo_id)
    return Response(content=stored.contents, media_type=stored.content_type, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"})


@router.get("/task-client-publications/tasks/{task_id}/pdf")
def manager_pdf(task_id: int, db: Session = Depends(get_db), user=ActiveUser):
    publication = service.manager_part(db, user, task_id)
    part = task_client_publication_content.response(publication)
    return Response(content=task_client_publication_pdf.build(part), media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="parte-{publication.id}.pdf"', "Cache-Control": "private, no-store"})


@router.get("/client-portal/workspaces/{grant_id}/services", response_model=PublishedWorkPage)
def list_parts(offset: int = Query(0, ge=0), db: Session = Depends(get_db), principal: ClientPortalPrincipal = ActiveClientPortal):
    return service.list_parts(db, principal, offset)


@router.get("/client-portal/workspaces/{grant_id}/services/{publication_id}", response_model=PublishedWork)
def read(publication_id: int, db: Session = Depends(get_db), principal: ClientPortalPrincipal = ActiveClientPortal):
    return service.read_part(db, principal, publication_id)


@router.get("/client-portal/workspaces/{grant_id}/services/{publication_id}/history", response_model=WorkAcceptancePage)
def history(publication_id: int, offset: int = Query(0, ge=0), db: Session = Depends(get_db), principal: ClientPortalPrincipal = ActiveClientPortal):
    return service.history(db, principal, publication_id, offset)


@router.post("/client-portal/workspaces/{grant_id}/services/{publication_id}/acceptance", response_model=PublishedWork)
def accept(publication_id: int, payload: AcceptTaskPart, request: Request, db: Session = Depends(get_db), principal: ClientPortalPrincipal = ActiveClientPortal):
    return service.accept(db, principal, publication_id, payload, request)


@router.get("/client-portal/workspaces/{grant_id}/services/{publication_id}/photos/{photo_id}")
def photo(publication_id: int, photo_id: str, db: Session = Depends(get_db), principal: ClientPortalPrincipal = ActiveClientPortal):
    stored = service.photo(db, principal, publication_id, photo_id)
    return Response(content=stored.contents, media_type=stored.content_type, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox"})


@router.get("/client-portal/workspaces/{grant_id}/services/{publication_id}/pdf")
def pdf(publication_id: int, db: Session = Depends(get_db), principal: ClientPortalPrincipal = ActiveClientPortal):
    part = service.read_part(db, principal, publication_id)
    return Response(content=task_client_publication_pdf.build(part), media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="parte-{publication_id}.pdf"', "Cache-Control": "private, no-store"})
