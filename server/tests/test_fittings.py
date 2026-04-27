"""/fittings 라우터 검증 — clothes 와 같은 패턴."""

from __future__ import annotations

from unittest.mock import MagicMock


def test_list_requires_auth(client):
    res = client.get("/fittings")
    assert res.status_code == 401


def test_upsert_requires_auth(client):
    res = client.post("/fittings/upsert", json={"items": []})
    assert res.status_code == 401


def test_delete_requires_auth(client):
    res = client.delete("/fittings/abc")
    assert res.status_code == 401


def test_list_filters_by_user_and_since(
    client, patch_jwks, valid_token, mock_supabase
):
    chain = (
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.gt.return_value
    )
    chain.execute.return_value = MagicMock(
        data=[{"id": "f1", "user_id": "user-A", "updated_at": "2026-04-27T01:00:00Z"}]
    )

    token = valid_token(user_id="user-A")
    res = client.get(
        "/fittings",
        params={"since": "2026-04-26T00:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    eq_calls = mock_supabase.table.return_value.select.return_value.eq.call_args_list
    assert any(c.args == ("user_id", "user-A") for c in eq_calls)


def test_upsert_overrides_user_id(client, patch_jwks, valid_token, mock_supabase):
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock(
        data=[{"id": "f1"}]
    )

    token = valid_token(user_id="user-A")
    res = client.post(
        "/fittings/upsert",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "items": [
                {
                    "id": "f1",
                    "user_id": "user-EVIL",
                    "result_image_url": "user-A/f1.jpg",
                    "clothing_ids": ["c1", "c2"],
                    "updated_at": "2026-04-27T02:00:00Z",
                }
            ]
        },
    )
    assert res.status_code == 200
    assert res.json()["upserted"] == 1

    sent = mock_supabase.table.return_value.upsert.call_args.args[0][0]
    assert sent["id"] == "f1"
    assert sent["user_id"] == "user-A"  # 서버가 덮어씀
    assert sent["clothing_ids"] == ["c1", "c2"]


def test_soft_delete_marks_deleted_at(
    client, patch_jwks, valid_token, mock_supabase
):
    chain = (
        mock_supabase.table.return_value.update.return_value.eq.return_value.eq.return_value
    )
    chain.execute.return_value = MagicMock(data=[{"id": "f1"}])

    token = valid_token(user_id="user-A")
    res = client.delete("/fittings/f1", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["deleted"] is True

    payload = mock_supabase.table.return_value.update.call_args.args[0]
    assert "deleted_at" in payload
    assert "updated_at" in payload
