from fastapi import HTTPException, status

from app.services.storage_service import (
    ObjectNotFoundError,
    build_media_key,
    get_object_storage,
    media_key_from_url,
)


def copy_report_media(media_url: str | None, company_id: int) -> str | None:
    if not media_url:
        return None
    try:
        key = media_key_from_url(media_url)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Invalid uploaded media",
        ) from error
    if key is None or not key.startswith(f"company/{company_id}/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Media must be uploaded by the reporting company",
        )
    storage = get_object_storage()
    try:
        stored = storage.get(key)
    except ObjectNotFoundError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Uploaded media was not found",
        ) from error
    extension = key.rsplit(".", 1)[-1].lower() if "." in key else "bin"
    report_key = build_media_key(company_id, "task-report", extension)
    storage.put(report_key, stored.contents, stored.content_type)
    return report_key
