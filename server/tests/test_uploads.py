"""/uploads/signed-url, /uploads/signed-read-url 라우터 검증."""

from __future__ import annotations

from unittest.mock import MagicMock


def test_signed_url_requires_auth(client):
    res = client.post(
        "/uploads/signed-url",
        json={"bucket": "clothes", "filename": "abc.jpg"},
    )
    assert res.status_code == 401


def test_signed_url_rejects_unknown_bucket(client, patch_jwks, valid_token):
    token = valid_token(user_id="u-1")
    res = client.post(
        "/uploads/signed-url",
        headers={"Authorization": f"Bearer {token}"},
        json={"bucket": "evil", "filename": "abc.jpg"},
    )
    assert res.status_code == 422


def test_signed_url_rejects_filename_with_slash(
    client, patch_jwks, valid_token, mock_supabase
):
    token = valid_token(user_id="u-1")
    res = client.post(
        "/uploads/signed-url",
        headers={"Authorization": f"Bearer {token}"},
        json={"bucket": "clothes", "filename": "../other-user/abc.jpg"},
    )
    assert res.status_code == 422


def test_signed_url_returns_upload_url_and_user_scoped_path(
    client, patch_jwks, valid_token, mock_supabase
):
    mock_supabase.storage.from_.return_value.create_signed_upload_url.return_value = {
        "signedUrl": "https://example.com/signed/upload/abc"
    }
    token = valid_token(user_id="user-42")
    res = client.post(
        "/uploads/signed-url",
        headers={"Authorization": f"Bearer {token}"},
        json={"bucket": "clothes", "filename": "abc.jpg"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["upload_url"] == "https://example.com/signed/upload/abc"
    assert body["read_path"] == "user-42/abc.jpg"
    assert body["expires_in"] == 600

    # 클라이언트가 보낸 prefix 와 무관하게 user_id 가 path 에 박혀야 한다.
    args, _ = mock_supabase.storage.from_.return_value.create_signed_upload_url.call_args
    assert args[0] == "user-42/abc.jpg"


def test_signed_read_url_returns_url(
    client, patch_jwks, valid_token, mock_supabase
):
    mock_supabase.storage.from_.return_value.create_signed_url.return_value = {
        "signedUrl": "https://example.com/signed/read/abc"
    }
    token = valid_token(user_id="user-7")
    res = client.post(
        "/uploads/signed-read-url",
        headers={"Authorization": f"Bearer {token}"},
        json={"bucket": "fittings", "filename": "x.jpg"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["url"] == "https://example.com/signed/read/abc"
    assert body["expires_in"] == 600
