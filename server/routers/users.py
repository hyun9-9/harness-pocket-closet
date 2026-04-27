"""사용자 부트스트랩 — 첫 로그인 직후 user_profiles row 를 멱등하게 만든다."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from middleware.auth import CurrentUser, get_current_user
from services.supabase_client import get_supabase

router = APIRouter(prefix="/users", tags=["users"])


class BootstrapResponse(BaseModel):
    user_id: str
    created: bool


@router.post("/bootstrap", response_model=BootstrapResponse)
def bootstrap(
    current_user: CurrentUser = Depends(get_current_user),
) -> BootstrapResponse:
    sb = get_supabase()
    user_id = current_user.user_id

    existing = (
        sb.table("user_profiles")
        .select("user_id")
        .eq("user_id", user_id)
        .execute()
    )
    rows = getattr(existing, "data", None) or []
    if rows:
        return BootstrapResponse(user_id=user_id, created=False)

    sb.table("user_profiles").insert({"user_id": user_id}).execute()
    return BootstrapResponse(user_id=user_id, created=True)
