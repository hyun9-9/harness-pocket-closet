"""옷 sync 라우터 — Local-first / LWW 흐름.

- GET  /clothes?since=<iso>      : updated_at > since 인 row 반환 (soft-delete 포함)
- POST /clothes/upsert            : { items: [...] } 배열 upsert. user_id 는 항상 서버에서 주입.
- DELETE /clothes/{id}            : soft delete (deleted_at = now)

모든 엔드포인트 인증 필수 (Authorization: Bearer JWT). service_role 클라이언트가
RLS 를 우회하지만 user_id 매칭은 서버에서 명시적으로 강제한다 — 클라가 보낸
user_id 값은 무시하고 current_user 의 것으로 덮어쓴다.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from middleware.auth import CurrentUser, get_current_user
from services.supabase_client import get_supabase

router = APIRouter(prefix="/clothes", tags=["clothes"])


class ClothingItem(BaseModel):
    id: str = Field(min_length=1)
    image_url: Optional[str] = None
    category: Optional[str] = None
    colors: Optional[List[str]] = None
    material: Optional[str] = None
    tags: Optional[List[str]] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    deleted_at: Optional[str] = None
    # 클라이언트가 user_id 를 보내도 무시 — 서버가 current_user.user_id 로 덮어쓴다.
    # 필드 자체는 받지 않는다.


class UpsertRequest(BaseModel):
    items: List[ClothingItem]


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
def list_clothes(
    since: Optional[str] = Query(default=None, description="ISO timestamp. updated_at > since"),
    current_user: CurrentUser = Depends(get_current_user),
) -> List[dict[str, Any]]:
    sb = get_supabase()
    query = (
        sb.table("clothes")
        .select("*")
        .eq("user_id", current_user.user_id)
        .order("updated_at", desc=False)
    )
    if since:
        query = query.gt("updated_at", since)
    res = query.execute()
    return _extract_rows(res)


@router.post("/upsert", response_model=UpsertResponse)
def upsert_clothes(
    body: UpsertRequest,
    current_user: CurrentUser = Depends(get_current_user),
) -> UpsertResponse:
    if not body.items:
        return UpsertResponse(upserted=0)

    now = _now_iso()
    rows: List[dict[str, Any]] = []
    for item in body.items:
        row: dict[str, Any] = item.model_dump(exclude_none=False)
        # 서버에서 user_id 강제 주입 — 클라가 보낸 값은 위에서 모델에서 거부됨.
        row["user_id"] = current_user.user_id
        # updated_at 누락 시 보강
        if not row.get("updated_at"):
            row["updated_at"] = now
        rows.append(row)

    sb = get_supabase()
    sb.table("clothes").upsert(rows, on_conflict="id").execute()
    return UpsertResponse(upserted=len(rows))


@router.delete("/{clothing_id}", response_model=DeleteResponse)
def soft_delete_clothing(
    clothing_id: str,
    current_user: CurrentUser = Depends(get_current_user),
) -> DeleteResponse:
    if not clothing_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="clothing_id_required",
        )
    now = _now_iso()
    sb = get_supabase()
    (
        sb.table("clothes")
        .update({"deleted_at": now, "updated_at": now})
        .eq("id", clothing_id)
        .eq("user_id", current_user.user_id)
        .execute()
    )
    return DeleteResponse(deleted=True)
