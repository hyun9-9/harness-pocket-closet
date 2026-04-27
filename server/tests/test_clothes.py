"""/clothes GET / upsert / DELETE 라우터 검증."""

from __future__ import annotations

from unittest.mock import MagicMock


def test_list_requires_auth(client):
    res = client.get("/clothes")
    assert res.status_code == 401


def test_upsert_requires_auth(client):
    res = client.post("/clothes/upsert", json={"items": []})
    assert res.status_code == 401


def test_delete_requires_auth(client):
    res = client.delete("/clothes/abc")
    assert res.status_code == 401


def test_list_filters_by_user_and_since(
    client, patch_jwks, valid_token, mock_supabase
):
    mock_chain = (
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.gt.return_value
    )
    mock_chain.execute.return_value = MagicMock(
        data=[{"id": "c1", "user_id": "user-A", "updated_at": "2026-04-27T01:00:00Z"}]
    )

    token = valid_token(user_id="user-A")
    res = client.get(
        "/clothes",
        params={"since": "2026-04-26T00:00:00Z"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    assert data[0]["id"] == "c1"

    # eq("user_id", "user-A") 가 호출됐는지
    eq_calls = mock_supabase.table.return_value.select.return_value.eq.call_args_list
    assert any(
        c.args == ("user_id", "user-A") for c in eq_calls
    ), f"eq calls: {eq_calls}"

    # gt("updated_at", since) 도 호출됐는지
    gt_calls = (
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.gt.call_args_list
    )
    assert any(c.args == ("updated_at", "2026-04-26T00:00:00Z") for c in gt_calls)


def test_list_without_since_skips_gt(
    client, patch_jwks, valid_token, mock_supabase
):
    # since 가 없으면 gt 가 호출되지 않고 곧장 execute() 가 불린다
    chain = mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value
    chain.execute.return_value = MagicMock(data=[])

    token = valid_token(user_id="user-A")
    res = client.get("/clothes", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200

    chain.gt.assert_not_called()


def test_upsert_overrides_user_id(client, patch_jwks, valid_token, mock_supabase):
    """클라이언트가 다른 user_id 를 보내도 서버가 current_user 로 덮어쓴다.

    ClothingItem 스키마에 user_id 필드 자체가 없어 Pydantic 단계에서 ignore 된다.
    upsert 직전 row 에 user_id = current_user.user_id 가 강제 set 된다.
    """
    mock_supabase.table.return_value.upsert.return_value.execute.return_value = MagicMock(
        data=[{"id": "c1"}]
    )

    token = valid_token(user_id="user-A")
    res = client.post(
        "/clothes/upsert",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "items": [
                {
                    "id": "c1",
                    # 클라가 다른 user 의 id 를 보내봐도
                    "user_id": "user-EVIL",
                    "image_url": "user-A/c1.jpg",
                    "category": "상의",
                    "updated_at": "2026-04-27T02:00:00Z",
                }
            ]
        },
    )
    assert res.status_code == 200
    assert res.json()["upserted"] == 1

    upsert_calls = mock_supabase.table.return_value.upsert.call_args_list
    assert len(upsert_calls) == 1
    rows, _kwargs = upsert_calls[0].args, upsert_calls[0].kwargs
    sent = rows[0]
    assert isinstance(sent, list)
    assert sent[0]["id"] == "c1"
    assert sent[0]["user_id"] == "user-A"  # ← 서버가 덮어씀
    assert _kwargs.get("on_conflict") == "id"


def test_upsert_empty_items_returns_zero(
    client, patch_jwks, valid_token, mock_supabase
):
    token = valid_token(user_id="user-A")
    res = client.post(
        "/clothes/upsert",
        headers={"Authorization": f"Bearer {token}"},
        json={"items": []},
    )
    assert res.status_code == 200
    assert res.json()["upserted"] == 0
    mock_supabase.table.return_value.upsert.assert_not_called()


def test_soft_delete_marks_deleted_at(
    client, patch_jwks, valid_token, mock_supabase
):
    chain = (
        mock_supabase.table.return_value.update.return_value.eq.return_value.eq.return_value
    )
    chain.execute.return_value = MagicMock(data=[{"id": "c1"}])

    token = valid_token(user_id="user-A")
    res = client.delete(
        "/clothes/c1", headers={"Authorization": f"Bearer {token}"}
    )
    assert res.status_code == 200
    assert res.json()["deleted"] is True

    update_calls = mock_supabase.table.return_value.update.call_args_list
    assert len(update_calls) == 1
    payload = update_calls[0].args[0]
    assert "deleted_at" in payload
    assert "updated_at" in payload

    # eq("id", "c1") 와 eq("user_id", "user-A") 둘 다 호출됐는지
    inner_eq_calls = mock_supabase.table.return_value.update.return_value.eq.call_args_list
    assert any(c.args == ("id", "c1") for c in inner_eq_calls)
    outer_eq_calls = (
        mock_supabase.table.return_value.update.return_value.eq.return_value.eq.call_args_list
    )
    assert any(c.args == ("user_id", "user-A") for c in outer_eq_calls)
