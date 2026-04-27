"""사용자 전신사진 (user_profiles) sync 라우터 — user 당 1 row.

- GET  /profile
- POST /profile/upsert    body: { person_image_url, deleted_at, updated_at }
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from middleware.auth import CurrentUser, get_current_user
from services.supabase_client import get_supabase

router = APIRouter(prefix="/profile", tags=["profile"])


class ProfileBody(BaseModel):
    person_image_url: Optional[str] = None
    updated_at: Optional[str] = None
    deleted_at: Optional[str] = None


class ProfileResponse(BaseModel):
    user_id: str
    person_image_url: Optional[str] = None
    updated_at: Optional[str] = None
    deleted_at: Optional[str] = None


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


@router.get("", response_model=Optional[ProfileResponse])
def get_profile(
    current_user: CurrentUser = Depends(get_current_user),
) -> Optional[ProfileResponse]:
    sb = get_supabase()
    res = (
        sb.table("user_profiles")
        .select("*")
        .eq("user_id", current_user.user_id)
        .execute()
    )
    rows = getattr(res, "data", None) or []
    if not rows:
        return None
    row = rows[0]
    return ProfileResponse(
        user_id=row.get("user_id", current_user.user_id),
        person_image_url=row.get("person_image_url"),
        updated_at=row.get("updated_at"),
        deleted_at=row.get("deleted_at"),
    )


@router.post("/upsert", response_model=ProfileResponse)
def upsert_profile(
    body: ProfileBody,
    current_user: CurrentUser = Depends(get_current_user),
) -> ProfileResponse:
    payload: dict[str, Any] = {
        "user_id": current_user.user_id,
        "person_image_url": body.person_image_url,
        "updated_at": body.updated_at or _now_iso(),
        "deleted_at": body.deleted_at,
    }
    sb = get_supabase()
    sb.table("user_profiles").upsert(payload, on_conflict="user_id").execute()
    return ProfileResponse(
        user_id=current_user.user_id,
        person_image_url=payload["person_image_url"],
        updated_at=payload["updated_at"],
        deleted_at=payload["deleted_at"],
    )
