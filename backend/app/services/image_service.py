import base64
import binascii
from io import BytesIO
import re

from fastapi import HTTPException, status
from PIL import Image, UnidentifiedImageError

from app.services.storage_service import (
    build_media_key,
    get_object_storage,
    media_url,
)

MAX_IMAGE_BYTES = 4 * 1024 * 1024
MAX_IMAGE_WIDTH = 8_000
MAX_IMAGE_HEIGHT = 8_000
MAX_IMAGE_PIXELS = 40_000_000


def _detect_image_content_type(contents: bytes) -> str | None:
    if contents.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if contents.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if contents.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if (
        len(contents) >= 12
        and contents.startswith(b"RIFF")
        and contents[8:12] == b"WEBP"
    ):
        return "image/webp"
    return None


def validate_image(contents: bytes) -> tuple[str, str]:
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The image is empty",
        )
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image must be 4MB or smaller",
        )

    content_type = _detect_image_content_type(contents)
    if content_type is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only valid JPG, PNG, WEBP or GIF images are allowed",
        )
    try:
        with Image.open(BytesIO(contents)) as image:
            width, height = image.size
            if (
                width > MAX_IMAGE_WIDTH
                or height > MAX_IMAGE_HEIGHT
                or width * height > MAX_IMAGE_PIXELS
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Image dimensions are too large",
                )
            image.verify()
    except HTTPException:
        raise
    except (
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
        UnidentifiedImageError,
        OSError,
        SyntaxError,
    ) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded image is invalid or corrupted",
        ) from error

    extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
    }[content_type]
    return content_type, extension


def encode_image_as_data_url(contents: bytes) -> str:
    content_type, _ = validate_image(contents)
    encoded = base64.b64encode(contents).decode("ascii")
    return f"data:{content_type};base64,{encoded}"


def store_image(contents: bytes, *, company_id: int, folder: str) -> str:
    content_type, extension = validate_image(contents)
    key = build_media_key(company_id, folder, extension)
    get_object_storage().put(key, contents, content_type)
    return media_url(key)


_DATA_URL_PATTERN = re.compile(
    r"^data:(image/(?:jpeg|png|gif|webp));base64,(.+)$",
    flags=re.IGNORECASE | re.DOTALL,
)


def store_image_data_url(value: str, *, company_id: int, folder: str) -> str:
    match = _DATA_URL_PATTERN.match(value)
    if not match:
        return value
    try:
        contents = base64.b64decode(match.group(2), validate=True)
    except (ValueError, binascii.Error) as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The stored image data is invalid",
        ) from error
    return store_image(contents, company_id=company_id, folder=folder)
