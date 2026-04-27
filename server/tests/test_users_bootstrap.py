"""/users/bootstrap 라우터 검증 — user_profiles 멱등 생성."""

from __future__ import annotations

from unittest.mock import MagicMock


def test_bootstrap_requires_auth(client):
    res = client.post("/users/bootstrap")
    assert res.status_code == 401


def test_bootstrap_creates_row_when_absent(
    client, patch_jwks, valid_token, mock_supabase
):
    # select(...).execute() 가 빈 data 를 반환 → 새로 insert 해야 함
    select_chain = (
        mock_supabase.table.return_value.select.return_value.eq.return_value
    )
    select_chain.execute.return_value = MagicMock(data=[])

    token = valid_token(user_id="user-new")
    res = client.post(
        "/users/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == "user-new"
    assert body["created"] is True

    # insert 가 호출됐는지 확인
    mock_supabase.table.return_value.insert.assert_called_once_with(
        {"user_id": "user-new"}
    )


def test_bootstrap_is_idempotent_when_row_exists(
    client, patch_jwks, valid_token, mock_supabase
):
    # select(...).execute() 가 1행을 반환 → insert 호출 안 함
    select_chain = (
        mock_supabase.table.return_value.select.return_value.eq.return_value
    )
    select_chain.execute.return_value = MagicMock(data=[{"user_id": "user-existing"}])

    token = valid_token(user_id="user-existing")
    res = client.post(
        "/users/bootstrap",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == "user-existing"
    assert body["created"] is False

    mock_supabase.table.return_value.insert.assert_not_called()
