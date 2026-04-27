"""/profile 라우터 검증 — user 당 1 row."""

from __future__ import annotations

from unittest.mock import MagicMock


def test_get_requires_auth(client):
    res = client.get("/profile")
    assert res.status_code == 401


def test_upsert_requires_auth(client):
    res = client.post("/profile/upsert", json={})
    assert res.status_code == 401


def test_get_returns_null_when_no_row(
    client, patch_jwks, valid_token, mock_supabase
):
    chain = mock_supabase.table.return_value.select.return_value.eq.return_value
    chain.execute.return_value = MagicMock(data=[])

    token = valid_token(user_id="user-A")
    res = client.get("/profile", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    # response_model=Optional[ProfileResponse] 라 None 직렬화는 null
    assert res.json() is None


def test_get_returns_existing_row(
    client, patch_jwks, valid_token, mock_supabase
):
    chain = mock_supabase.table.return_value.select.return_value.eq.return_value
    chain.execute.return_value = MagicMock(
        data=[
            {
                "user_id": "user-A",
                "person_image_url": "user-A/me.jpg",
                "updated_at": "2026-04-27T01:00:00Z",
                "deleted_at": None,
            }
        ]
    )

    token = valid_token(user_id="user-A")
    res = client.get("/profile", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == "user-A"
    assert body["person_image_url"] == "user-A/me.jpg"


def test_upsert_overrides_user_id(
    client, patch_jwks, valid_token, mock_supabase
):
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock(
        data=[{"user_id": "user-A"}]
    )
    token = valid_token(user_id="user-A")
    res = client.post(
        "/profile/upsert",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "person_image_url": "user-A/me.jpg",
            "updated_at": "2026-04-27T02:00:00Z",
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["user_id"] == "user-A"
    assert body["person_image_url"] == "user-A/me.jpg"

    payload = mock_supabase.table.return_value.upsert.call_args.args[0]
    assert payload["user_id"] == "user-A"  # 서버가 강제 set
    assert payload["person_image_url"] == "user-A/me.jpg"

    kwargs = mock_supabase.table.return_value.upsert.call_args.kwargs
    assert kwargs.get("on_conflict") == "user_id"
