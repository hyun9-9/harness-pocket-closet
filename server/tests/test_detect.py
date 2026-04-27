import os

from schemas import DetectMultiItem

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "sample.jpg")


_VALID_TWO = (
    '['
    '{"category":"상의","colors":["검정"],"material":"면","tags":["베이직"],'
    '"confidence":0.95,"box_2d":[10,10,500,400]},'
    '{"category":"하의","colors":["청"],"material":"데님","tags":["슬림"],'
    '"confidence":0.92,"box_2d":[400,200,950,800]}'
    ']'
)


def _fake_two(prompt, images):
    return _VALID_TWO


def test_detect_multi_returns_items(client, monkeypatch):
    monkeypatch.setattr("routers.detect.call_flash_multimodal", _fake_two)
    with open(FIXTURE, "rb") as f:
        response = client.post(
            "/detect-multi",
            files={"file": ("a.jpg", f, "image/jpeg")},
        )
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2
    items = [DetectMultiItem.model_validate(x) for x in data]
    assert items[0].category == "상의"
    assert items[0].box_2d == [10, 10, 500, 400]
    assert 0.0 <= items[0].confidence <= 1.0
    assert items[1].category == "하의"


def test_detect_multi_filters_invalid_box(client, monkeypatch):
    bad = (
        '[{"category":"상의","colors":[],"material":"","tags":[],'
        '"confidence":0.5,"box_2d":[10,10,5,5]},'
        '{"category":"하의","colors":[],"material":"","tags":[],'
        '"confidence":0.5,"box_2d":[100,100,500,400]}]'
    )
    monkeypatch.setattr(
        "routers.detect.call_flash_multimodal", lambda p, i: bad
    )
    with open(FIXTURE, "rb") as f:
        response = client.post(
            "/detect-multi",
            files={"file": ("a.jpg", f, "image/jpeg")},
        )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["category"] == "하의"


def test_detect_multi_filters_invalid_category(client, monkeypatch):
    bad = (
        '[{"category":"음식","colors":[],"material":"","tags":[],'
        '"confidence":0.5,"box_2d":[10,10,500,500]},'
        '{"category":"상의","colors":[],"material":"","tags":[],'
        '"confidence":0.5,"box_2d":[10,10,500,500]}]'
    )
    monkeypatch.setattr(
        "routers.detect.call_flash_multimodal", lambda p, i: bad
    )
    with open(FIXTURE, "rb") as f:
        response = client.post(
            "/detect-multi",
            files={"file": ("a.jpg", f, "image/jpeg")},
        )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["category"] == "상의"


def test_detect_multi_rejects_empty_file(client, monkeypatch):
    monkeypatch.setattr("routers.detect.call_flash_multimodal", _fake_two)
    response = client.post(
        "/detect-multi",
        files={"file": ("a.jpg", b"", "image/jpeg")},
    )
    assert response.status_code == 400


def test_detect_multi_rejects_bad_json(client, monkeypatch):
    monkeypatch.setattr(
        "routers.detect.call_flash_multimodal", lambda p, i: "not a json"
    )
    with open(FIXTURE, "rb") as f:
        response = client.post(
            "/detect-multi",
            files={"file": ("a.jpg", f, "image/jpeg")},
        )
    assert response.status_code == 400


def test_detect_multi_requires_file(client):
    response = client.post("/detect-multi")
    assert response.status_code == 422
