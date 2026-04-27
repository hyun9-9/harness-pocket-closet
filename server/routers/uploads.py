"""Storage signed URL 발급 — 클라이언트는 service_role key 없이 PUT/GET 가능.

객체 경로는 항상 `{user_id}/{filename}` 으로 강제. 클라이언트가 다른 prefix 를
지정해도 무시한다 (RLS 정책의 `(storage.foldername(name))[1] = auth.uid()::text`
와 일관성 유지).
"""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from middleware.auth import CurrentUser, get_current_user
from services.supabase_client import get_supabase

router = APIRouter(prefix="/uploads", tags=["uploads"])

Bucket = Literal["clothes", "fittings", "person"]
_SIGNED_TTL_SECONDS = 600


class SignedUrlRequest(BaseModel):
    bucket: Bucket
    filename: str = Field(min_length=1, max_length=255)


class SignedUploadResponse(BaseModel):
    upload_url: str
    read_path: str
    expires_in: int


class SignedReadResponse(BaseModel):
    url: str
    expires_in: int


def _build_object_path(user_id: str, filename: str) -> str:
    # filename 에 슬래시가 포함되면 클라가 다른 prefix 를 우회하려는 시도이므로 거부.
    if "/" in filename or ".." in filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="filename_must_not_contain_slash_or_dotdot",
        )
    return f"{user_id}/{filename}"


@router.post("/signed-url", response_model=SignedUploadResponse)
def create_signed_upload_url(
    body: SignedUrlRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> SignedUploadResponse:
    path = _build_object_path(current_user.user_id, body.filename)
    sb = get_supabase()
    res = sb.storage.from_(body.bucket).create_signed_upload_url(path)
    upload_url = _extract_signed_url(res)
    return SignedUploadResponse(
        upload_url=upload_url,
        read_path=path,
        expires_in=_SIGNED_TTL_SECONDS,
    )


@router.post("/signed-read-url", response_model=SignedReadResponse)
def create_signed_read_url(
    body: SignedUrlRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> SignedReadResponse:
    path = _build_object_path(current_user.user_id, body.filename)
    sb = get_supabase()
    res = sb.storage.from_(body.bucket).create_signed_url(path, _SIGNED_TTL_SECONDS)
    url = _extract_signed_url(res)
    return SignedReadResponse(url=url, expires_in=_SIGNED_TTL_SECONDS)


def _extract_signed_url(res: object) -> str:
    """Supabase Python SDK 응답 형태가 버전에 따라 다른 것을 흡수.

    - dict: {"signedUrl": "..."} or {"signed_url": "..."} or {"signedURL": "..."}
    - 객체: 같은 이름의 속성
    """
    if isinstance(res, dict):
        for key in ("signedUrl", "signed_url", "signedURL", "url"):
            if key in res and isinstance(res[key], str):
                return res[key]
    for attr in ("signed_url", "signedUrl", "signedURL", "url"):
        value = getattr(res, attr, None)
        if isinstance(value, str):
            return value
    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail="storage_signed_url_unavailable",
    )
