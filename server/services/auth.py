"""Supabase JWT 검증 — JWKS 비대칭 흐름 (ECC P-256).

이 프로젝트의 Supabase 는 새 비대칭 signing key 시스템을 쓴다. 옛 HS256
shared-secret (`SUPABASE_JWT_SECRET`) 흐름은 사용하지 않으며, 서버는 JWKS
endpoint(`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`) 에서 공개키를 받아
검증한다. PyJWKClient 가 키 캐싱을 담당.
"""

from __future__ import annotations

from typing import Optional, TypedDict

import jwt
from jwt import PyJWKClient

from config import settings


class JWTError(Exception):
    """JWT 검증 단계에서 발생하는 모든 오류의 공통 타입."""


class CurrentUserDict(TypedDict):
    user_id: str
    email: Optional[str]


_jwks_client: Optional[PyJWKClient] = None


def _get_jwks_client() -> PyJWKClient:
    """JWKS 클라이언트 싱글턴 — 키 캐싱을 위해."""
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = PyJWKClient(settings.supabase_jwks_url)
    return _jwks_client


def reset_jwks_client() -> None:
    """테스트 격리용."""
    global _jwks_client
    _jwks_client = None


def decode_supabase_jwt(token: str) -> dict:
    """Supabase 가 발급한 JWT 를 검증하고 payload 를 반환한다.

    검증 항목
    - 서명 (JWKS 의 공개키, ES256 / RS256 / HS256 다 허용 — Supabase 가 어떤
      알고리즘으로 마이그레이션해도 통과)
    - 만료(`exp`)
    - audience == "authenticated" (Supabase 표준)
    - sub / exp 필수 클레임 존재

    실패 시 :class:`JWTError` 를 던진다.
    """
    try:
        signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "HS256"],
            audience="authenticated",
            options={"require": ["exp", "sub"]},
        )
        return payload
    except jwt.ExpiredSignatureError as e:
        raise JWTError("token expired") from e
    except jwt.InvalidTokenError as e:
        raise JWTError(f"invalid token: {e}") from e
    except Exception as e:
        # PyJWKClient 가 네트워크 에러 등을 raise 할 수 있으므로 catch-all.
        raise JWTError(f"jwt verification failed: {e}") from e


def extract_user(payload: dict) -> CurrentUserDict:
    """검증된 payload 에서 user_id / email 만 뽑아낸다."""
    user_id = payload.get("sub")
    if not user_id:
        raise JWTError("payload missing sub")
    email = payload.get("email")
    return {"user_id": str(user_id), "email": email}
