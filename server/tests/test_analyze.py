import os

from schemas import AnalyzeResponseItem

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "sample.jpg")


def _fake_multimodal_one(prompt, images):
    return '[{"category":"상의","colors":["검정"],"material":"면","tags":["베이직"]}]'


def _fake_multimodal_two(prompt, images):
    return (
        '[{"category":"상의","colors":["검정"],"material":"면","tags":["베이직"]},'
        '{"category":"하의","colors":["청"],"material":"데님","tags":["슬림"]}]'
    )


def test_analyze_single_image(client, monkeypatch):
    monkeypatch.setattr(
        "routers.analyze.call_flash_multimodal", _fake_multimodal_one
    )
    with open(FIXTURE, "rb") as f:
        response = client.post(
            "/analyze",
            files=[("files", ("a.jpg", f, "image/jpeg"))],
        )
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 1
    item = AnalyzeResponseItem.model_validate(data[0])
    assert item.category == "상의"
    assert "검정" in item.colors
    assert item.material == "면"


def test_analyze_multi_image(client, monkeypatch):
    monkeypatch.setattr(
        "routers.analyze.call_flash_multimodal", _fake_multimodal_two
    )
    files = []
    f1 = open(FIXTURE, "rb")
    f2 = open(FIXTURE, "rb")
    try:
        files = [
            ("files", ("a.jpg", f1, "image/jpeg")),
            ("files", ("b.jpg", f2, "image/jpeg")),
        ]
        response = client.post("/analyze", files=files)
    finally:
        f1.close()
        f2.close()
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    [AnalyzeResponseItem.model_validate(x) for x in data]


def test_analyze_rejects_zero_files(client):
    response = client.post("/analyze")
    assert response.status_code in (400, 422)


def test_analyze_rejects_too_many_files(client, monkeypatch):
    monkeypatch.setattr(
        "routers.analyze.call_flash_multimodal", _fake_multimodal_one
    )
    fs = [open(FIXTURE, "rb") for _ in range(6)]
    try:
        files = [("files", (f"x{i}.jpg", fs[i], "image/jpeg")) for i in range(6)]
        response = client.post("/analyze", files=files)
    finally:
        for f in fs:
            f.close()
    assert response.status_code == 400


def test_analyze_rejects_bad_json(client, monkeypatch):
    monkeypatch.setattr(
        "routers.analyze.call_flash_multimodal",
        lambda prompt, images: "not a json",
    )
    with open(FIXTURE, "rb") as f:
        response = client.post(
            "/analyze",
            files=[("files", ("a.jpg", f, "image/jpeg"))],
        )
    assert response.status_code == 400
