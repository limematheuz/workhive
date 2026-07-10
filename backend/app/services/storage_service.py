from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Protocol
from uuid import uuid4

from app.core.config import settings


@dataclass(frozen=True)
class StoredObject:
    contents: bytes
    content_type: str


class ObjectNotFoundError(Exception):
    pass


class ObjectStorage(Protocol):
    def put(self, key: str, contents: bytes, content_type: str) -> None: ...

    def get(self, key: str) -> StoredObject: ...

    def delete(self, key: str) -> None: ...

    def check(self) -> None: ...


def normalize_key(key: str) -> str:
    path = PurePosixPath(key)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError("Invalid media key")
    return str(path)


class LocalObjectStorage:
    def __init__(self, root: str):
        self.root = Path(root).expanduser().resolve()

    def _path(self, key: str) -> Path:
        normalized = normalize_key(key)
        path = (self.root / normalized).resolve()
        if self.root not in path.parents:
            raise ValueError("Invalid media key")
        return path

    def put(self, key: str, contents: bytes, content_type: str) -> None:
        path = self._path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_name(f".{path.name}.{uuid4().hex}.tmp")
        temporary.write_bytes(contents)
        temporary.replace(path)
        path.with_suffix(f"{path.suffix}.content-type").write_text(
            content_type,
            encoding="ascii",
        )

    def get(self, key: str) -> StoredObject:
        path = self._path(key)
        content_type_path = path.with_suffix(f"{path.suffix}.content-type")
        try:
            return StoredObject(
                contents=path.read_bytes(),
                content_type=content_type_path.read_text(encoding="ascii"),
            )
        except FileNotFoundError as error:
            raise ObjectNotFoundError(key) from error

    def delete(self, key: str) -> None:
        path = self._path(key)
        path.unlink(missing_ok=True)
        path.with_suffix(f"{path.suffix}.content-type").unlink(missing_ok=True)

    def check(self) -> None:
        self.root.mkdir(parents=True, exist_ok=True)
        probe_key = f".health/{uuid4().hex}"
        self.put(probe_key, b"ok", "application/octet-stream")
        self.delete(probe_key)


class S3ObjectStorage:
    def __init__(self):
        try:
            import boto3
        except ImportError as error:
            raise RuntimeError(
                "The boto3 package is required when MEDIA_STORAGE_BACKEND=s3"
            ) from error

        self.bucket = settings.S3_BUCKET or ""
        client_options = {
            "endpoint_url": settings.S3_ENDPOINT_URL,
            "region_name": settings.S3_REGION,
        }
        if settings.S3_ACCESS_KEY_ID and settings.S3_SECRET_ACCESS_KEY:
            client_options.update(
                {
                    "aws_access_key_id": settings.S3_ACCESS_KEY_ID,
                    "aws_secret_access_key": settings.S3_SECRET_ACCESS_KEY,
                }
            )
        self.client = boto3.client("s3", **client_options)

    def put(self, key: str, contents: bytes, content_type: str) -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=normalize_key(key),
            Body=contents,
            ContentType=content_type,
            ServerSideEncryption="AES256",
        )

    def get(self, key: str) -> StoredObject:
        try:
            response = self.client.get_object(
                Bucket=self.bucket,
                Key=normalize_key(key),
            )
        except self.client.exceptions.NoSuchKey as error:
            raise ObjectNotFoundError(key) from error
        return StoredObject(
            contents=response["Body"].read(),
            content_type=response.get("ContentType") or "application/octet-stream",
        )

    def delete(self, key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=normalize_key(key))

    def check(self) -> None:
        self.client.head_bucket(Bucket=self.bucket)


def get_object_storage() -> ObjectStorage:
    if settings.MEDIA_STORAGE_BACKEND == "s3":
        return S3ObjectStorage()
    return LocalObjectStorage(settings.MEDIA_STORAGE_PATH)


def build_media_key(company_id: int, folder: str, extension: str) -> str:
    safe_folder = normalize_key(folder)
    return f"company/{company_id}/{safe_folder}/{uuid4().hex}.{extension}"


def media_url(key: str) -> str:
    return f"{settings.API_V1_STR}/uploads/media/{normalize_key(key)}"


def media_key_from_url(url: str) -> str | None:
    prefix = f"{settings.API_V1_STR}/uploads/media/"
    if not url.startswith(prefix):
        return None
    return normalize_key(url.removeprefix(prefix))
