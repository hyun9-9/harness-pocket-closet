"""FastAPI dependency — Authorization Bearer JWT 를 CurrentUser 로 변환."""

from __future__ import annotations

from typing import Optional

from fastapi import Header, HTTPException, status
from pydantic import BaseModel

from services.auth import JWTError, decode_supabase_jwt, extract_user


class CurrentUser(BaseModel):
    user_id: str
    email: Optional[str] = None


_INVALID = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="invalid_token",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    authorization: Optional[str] = Header(default=None),
) -> CurrentUser:
    """`Authorization: Bearer <jwt>` 를 검증해 CurrentUser 로 반환.

    헤더 누락 / 형식 오류 / 검증 실패 모두 401 invalid_token.
    """
    if not authorization:
        raise _INVALID

    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer" or not parts[1].strip():
        raise _INVALID

    token = parts[1].strip()
    try:
        payload = decode_supabase_jwt(token)
        info = extract_user(payload)
    except JWTError:
        raise _INVALID

    return CurrentUser(user_id=info["user_id"], email=info["email"])
