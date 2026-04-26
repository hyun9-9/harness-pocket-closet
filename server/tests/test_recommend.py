from schemas import RecommendResponse


def _fake_three(prompt):
    return (
        '{"combinations":['
        '{"clothing_ids":["a","b"],"comment":"심플",'
        '"styling_prompt":"Tuck shirt into pants for clean line."},'
        '{"clothing_ids":["a","c"],"comment":"포멀",'
        '"styling_prompt":"Roll sleeves to forearm; outer open."},'
        '{"clothing_ids":["b","c"],"comment":"캐주얼",'
        '"styling_prompt":"Oversized fit; relaxed silhouette."}'
        "]}"
    )


def _fake_one(prompt):
    return (
        '{"combinations":[{"clothing_ids":["a","b"],"comment":"심플",'
        '"styling_prompt":"Keep silhouette balanced."}]}'
    )


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
    assert parsed.combinations[0].styling_prompt == "Tuck shirt into pants for clean line."


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
    assert parsed.combinations[0].styling_prompt == "Keep silhouette balanced."


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


def test_recommend_styling_prompt_missing_falls_back_to_empty(client, monkeypatch):
    monkeypatch.setattr(
        "routers.recommend.call_flash_text",
        lambda prompt: '{"combinations":[{"clothing_ids":["a"],"comment":"x"}]}',
    )
    body = {
        "occasion": "출근",
        "clothes": [
            {"id": "a", "category": "상의", "colors": [], "material": "", "tags": []}
        ],
    }
    response = client.post("/recommend", json=body)
    assert response.status_code == 200
    parsed = RecommendResponse.model_validate(response.json())
    assert parsed.combinations[0].styling_prompt == ""


def test_recommend_styling_prompt_trimmed_to_400(client, monkeypatch):
    long_text = "x" * 1000
    monkeypatch.setattr(
        "routers.recommend.call_flash_text",
        lambda prompt: (
            '{"combinations":[{"clothing_ids":["a"],"comment":"x",'
            f'"styling_prompt":"{long_text}"}}]}}'
        ),
    )
    body = {
        "occasion": "출근",
        "clothes": [
            {"id": "a", "category": "상의", "colors": [], "material": "", "tags": []}
        ],
    }
    response = client.post("/recommend", json=body)
    assert response.status_code == 200
    parsed = RecommendResponse.model_validate(response.json())
    assert len(parsed.combinations[0].styling_prompt) == 400


def test_recommend_styling_prompt_non_string_coerced_to_empty(client, monkeypatch):
    monkeypatch.setattr(
        "routers.recommend.call_flash_text",
        lambda prompt: (
            '{"combinations":[{"clothing_ids":["a"],"comment":"x",'
            '"styling_prompt":12345}]}'
        ),
    )
    body = {
        "occasion": "출근",
        "clothes": [
            {"id": "a", "category": "상의", "colors": [], "material": "", "tags": []}
        ],
    }
    response = client.post("/recommend", json=body)
    assert response.status_code == 200
    parsed = RecommendResponse.model_validate(response.json())
    assert parsed.combinations[0].styling_prompt == ""
