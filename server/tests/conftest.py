"""테스트 공용 fixture.

JWT 검증 흐름은 Supabase JWKS 비대칭(ECC P-256) 이므로, 테스트에선:
  - ec_keypair    : ECC P-256 키페어를 1회 생성 (session-scoped)
  - patch_jwks    : services.auth._get_jwks_client 를 fake 로 monkeypatch
  - valid_token   : ec_keypair private 으로 ES256 서명한 JWT 발급 헬퍼
  - mock_supabase : services.supabase_client.get_supabase 를 MagicMock 으로 패치
"""

from __future__ import annotations

import time
from typing import Any
from unittest.mock import MagicMock

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def ec_keypair() -> dict[str, Any]:
    """ECC P-256 키페어 — Supabase 의 비대칭 JWT signing key 와 같은 곡선."""
    private_key = ec.generate_private_key(ec.SECP256R1())
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )
    return {
        "private_pem": private_pem,
        "public_key": private_key.public_key(),
    }


@pytest.fixture
def patch_jwks(monkeypatch, ec_keypair):
    """JWKS 검증 흐름을 fake 로 우회 — fake_get_signing_key_from_jwt 가 ec_keypair
    의 public key 를 반환한다."""

    class _FakeKey:
        def __init__(self, key):
            self.key = key

    class _FakeJwksClient:
        def __init__(self, public_key):
            self._public_key = public_key

        def get_signing_key_from_jwt(self, token: str):  # noqa: ARG002
            return _FakeKey(self._public_key)

    fake = _FakeJwksClient(ec_keypair["public_key"])

    from services import auth as auth_svc

    auth_svc.reset_jwks_client()
    monkeypatch.setattr(auth_svc, "_get_jwks_client", lambda: fake)
    yield
    auth_svc.reset_jwks_client()


@pytest.fixture
def valid_token(ec_keypair):
    """payload 를 받아 ES256 으로 서명한 JWT 를 만든다."""

    def _make(
        user_id: str = "u-1",
        email: str | None = None,
        exp_offset: int = 3600,
        audience: str = "authenticated",
        **extra,
    ) -> str:
        payload: dict[str, Any] = {
            "sub": user_id,
            "aud": audience,
            "exp": int(time.time()) + exp_offset,
        }
        if email is not None:
            payload["email"] = email
        payload.update(extra)
        return jwt.encode(payload, ec_keypair["private_pem"], algorithm="ES256")

    return _make


@pytest.fixture
def mock_supabase(monkeypatch):
    """services.supabase_client.get_supabase 를 MagicMock 으로 monkeypatch.

    routers.uploads / routers.users 는 import 시점에 함수를 가져오는 게 아니라
    호출 시점에 from-import 한 이름을 lookup 하므로, 두 namespace 모두 패치해
    각 라우터에서 가져갈 mock 이 일관되게 동일 객체가 되도록 한다.
    """
    mock_client = MagicMock()

    monkeypatch.setattr("services.supabase_client.get_supabase", lambda: mock_client)
    monkeypatch.setattr("routers.uploads.get_supabase", lambda: mock_client)
    monkeypatch.setattr("routers.users.get_supabase", lambda: mock_client)
    return mock_client
