"""middleware.auth.get_current_user 단독 검증."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from middleware.auth import get_current_user


def test_no_authorization_header_returns_401():
    with pytest.raises(HTTPException) as exc:
        get_current_user(authorization=None)
    assert exc.value.status_code == 401
    assert exc.value.detail == "invalid_token"


def test_malformed_authorization_returns_401():
    with pytest.raises(HTTPException) as exc:
        get_current_user(authorization="Token abc")
    assert exc.value.status_code == 401


def test_empty_bearer_returns_401():
    with pytest.raises(HTTPException) as exc:
        get_current_user(authorization="Bearer ")
    assert exc.value.status_code == 401


def test_invalid_token_returns_401(patch_jwks):
    with pytest.raises(HTTPException) as exc:
        get_current_user(authorization="Bearer not.a.real.token")
    assert exc.value.status_code == 401


def test_expired_token_returns_401(patch_jwks, valid_token):
    expired = valid_token(exp_offset=-60)
    with pytest.raises(HTTPException) as exc:
        get_current_user(authorization=f"Bearer {expired}")
    assert exc.value.status_code == 401


def test_wrong_audience_returns_401(patch_jwks, valid_token):
    bad = valid_token(audience="wrong-audience")
    with pytest.raises(HTTPException) as exc:
        get_current_user(authorization=f"Bearer {bad}")
    assert exc.value.status_code == 401


def test_valid_token_returns_current_user(patch_jwks, valid_token):
    token = valid_token(user_id="u-42", email="me@x.com")
    user = get_current_user(authorization=f"Bearer {token}")
    assert user.user_id == "u-42"
    assert user.email == "me@x.com"


def test_valid_token_without_email(patch_jwks, valid_token):
    token = valid_token(user_id="u-1")
    user = get_current_user(authorization=f"Bearer {token}")
    assert user.user_id == "u-1"
    assert user.email is None
