from schemas import RecommendResponse


def _fake_three(prompt):
    return (
        '{"combinations":['
        '{"clothing_ids":["a","b"],"comment":"심플"},'
        '{"clothing_ids":["a","c"],"comment":"포멀"},'
        '{"clothing_ids":["b","c"],"comment":"캐주얼"}'
        "]}"
    )


def _fake_one(prompt):
    return '{"combinations":[{"clothing_ids":["a","b"],"comment":"심플"}]}'


def test_recommend_three_combinations(client, monkeypatch):
    monkeypatch.setattr("routers.recommend.call_flash_text", _fake_three)
    body = {
        "occasion": "출근",
        "clothes": [
            {"id": "a", "category": "상의", "colors": ["검정"], "material": "면", "tags": []},
            {"id": "b", "category": "하의", "colors": ["네이비"], "material": "면", "tags": []},
            {"id": "c", "category": "아우터", "colors": ["회색"], "material": "울", "tags": []},
        ],
    }
    response = client.post("/recommend", json=body)
    assert response.status_code == 200, response.text
    parsed = RecommendResponse.model_validate(response.json())
    assert len(parsed.combinations) == 3
    assert parsed.combinations[0].comment == "심플"


def test_recommend_with_two_items(client, monkeypatch):
    monkeypatch.setattr("routers.recommend.call_flash_text", _fake_one)
    body = {
        "occasion": "캐주얼",
        "clothes": [
            {"id": "a", "category": "상의", "colors": ["흰색"], "material": "면", "tags": []},
            {"id": "b", "category": "하의", "colors": ["청"], "material": "데님", "tags": []},
        ],
    }
    response = client.post("/recommend", json=body)
    assert response.status_code == 200
    parsed = RecommendResponse.model_validate(response.json())
    assert len(parsed.combinations) <= 3
    assert len(parsed.combinations) == 1


def test_recommend_rejects_bad_json(client, monkeypatch):
    monkeypatch.setattr(
        "routers.recommend.call_flash_text", lambda prompt: "not json"
    )
    body = {
        "occasion": "출근",
        "clothes": [
            {"id": "a", "category": "상의", "colors": [], "material": "", "tags": []}
        ],
    }
    response = client.post("/recommend", json=body)
    assert response.status_code == 400
