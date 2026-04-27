"""피팅 sync 라우터 — clothes 와 같은 패턴.

- GET    /fittings?since=<iso>
- POST   /fittings/upsert
- DELETE /fittings/{id}     soft delete

모두 인증 필수. user_id 는 항상 서버에서 current_user.user_id 로 강제 주입.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from middleware.auth import CurrentUser, get_current_user
from services.supabase_client import get_supabase

router = APIRouter(prefix="/fittings", tags=["fittings"])


class FittingItem(BaseModel):
    id: str = Field(min_length=1)
    result_image_url: Optional[str] = None
    clothing_ids: Optional[List[str]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    deleted_at: Optional[str] = None


class UpsertRequest(BaseModel):
    items: List[FittingItem]


class UpsertResponse(BaseModel):
    upserted: int


class DeleteResponse(BaseModel):
    deleted: bool


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _extract_rows(res: object) -> List[dict[str, Any]]:
    data = getattr(res, "data", None)
    if isinstance(data, list):
        return data
    return []


@router.get("")
def list_fittings(
    since: Optional[str] = Query(default=None),
    current_user: CurrentUser = Depends(get_current_user),
) -> List[dict[str, Any]]:
    sb = get_supabase()
    query = (
        sb.table("fittings")
        .select("*")
        .eq("user_id", current_user.user_id)
        .order("updated_at", desc=False)
    )
    if since:
        query = query.gt("updated_at", since)
    res = query.execute()
    return _extract_rows(res)


@router.post("/upsert", response_model=UpsertResponse)
def upsert_fittings(
    body: UpsertRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> UpsertResponse:
    if not body.items:
        return UpsertResponse(upserted=0)

    now = _now_iso()
    rows: List[dict[str, Any]] = []
    for item in body.items:
        row: dict[str, Any] = item.model_dump(exclude_none=False)
        row["user_id"] = current_user.user_id
        if not row.get("updated_at"):
            row["updated_at"] = now
        rows.append(row)

    sb = get_supabase()
    sb.table("fittings").upsert(rows, on_conflict="id").execute()
    return UpsertResponse(upserted=len(rows))


@router.delete("/{fitting_id}", response_model=DeleteResponse)
def soft_delete_fitting(
    fitting_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> DeleteResponse:
    if not fitting_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="fitting_id_required",
        )
    now = _now_iso()
    sb = get_supabase()
    (
        sb.table("fittings")
        .update({"deleted_at": now, "updated_at": now})
        .eq("id", fitting_id)
        .eq("user_id", current_user.user_id)
        .execute()
    )
    return DeleteResponse(deleted=True)
