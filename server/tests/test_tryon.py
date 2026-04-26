import base64
import json
import os

from schemas import TryOnResponse

FIXTURE = os.path.join(os.path.dirname(__file__), "fixtures", "sample.jpg")

with open(FIXTURE, "rb") as _f:
    DUMMY_JPEG = _f.read()


def _fake_image_edit(prompt, images):
    return DUMMY_JPEG


def test_tryon_returns_base64_jpeg(client, monkeypatch):
    captured = {}

    def _capture(prompt, images):
        captured["prompt"] = prompt
        return DUMMY_JPEG

    monkeypatch.setattr("routers.tryon.call_pro_image_edit", _capture)
    meta = json.dumps(
        {
            "person": {"height": 170},
            "clothes": [{"category": "상의", "colors": ["검정"], "material": "면"}],
        },
        ensure_ascii=False,
    )
    with open(FIXTURE, "rb") as p, open(FIXTURE, "rb") as c:
        response = client.post(
            "/try-on",
            files=[
                ("person", ("p.jpg", p, "image/jpeg")),
                ("clothes", ("c.jpg", c, "image/jpeg")),
            ],
            data={"meta": meta},
        )
    assert response.status_code == 200, response.text
    body = TryOnResponse.model_validate(response.json())
    assert body.mime == "image/jpeg"
    decoded = base64.b64decode(body.image_base64)
    assert decoded == DUMMY_JPEG
    # styling_prompt 미전송 시 prompt 에 styling 섹션이 없어야 함
    assert "Styling guide" not in captured["prompt"]


def test_tryon_multi_clothes(client, monkeypatch):
    captured = {}

    def _capture(prompt, images):
        captured["len"] = len(images)
        captured["prompt"] = prompt
        return DUMMY_JPEG

    monkeypatch.setattr("routers.tryon.call_pro_image_edit", _capture)
    meta = json.dumps({"note": "test"})
    fs = [open(FIXTURE, "rb") for _ in range(3)]
    try:
        response = client.post(
            "/try-on",
            files=[
                ("person", ("p.jpg", fs[0], "image/jpeg")),
                ("clothes", ("c1.jpg", fs[1], "image/jpeg")),
                ("clothes", ("c2.jpg", fs[2], "image/jpeg")),
            ],
            data={"meta": meta},
        )
    finally:
        for f in fs:
            f.close()
    assert response.status_code == 200
    assert captured["len"] == 3
    assert "test" in captured["prompt"]


def test_tryon_requires_person(client):
    response = client.post("/try-on", data={"meta": "{}"})
    assert response.status_code in (400, 422)


def test_tryon_styling_prompt_appended(client, monkeypatch):
    captured = {}

    def _capture(prompt, images):
        captured["prompt"] = prompt
        return DUMMY_JPEG

    monkeypatch.setattr("routers.tryon.call_pro_image_edit", _capture)
    sp = "Tuck shirt into pants; roll sleeves to forearm."
    with open(FIXTURE, "rb") as p, open(FIXTURE, "rb") as c:
        response = client.post(
            "/try-on",
            files=[
                ("person", ("p.jpg", p, "image/jpeg")),
                ("clothes", ("c.jpg", c, "image/jpeg")),
            ],
            data={"meta": "{}", "styling_prompt": sp},
        )
    assert response.status_code == 200, response.text
    assert "Styling guide" in captured["prompt"]
    assert sp in captured["prompt"]


def test_tryon_styling_prompt_trimmed_to_400(client, monkeypatch):
    captured = {}

    def _capture(prompt, images):
        captured["prompt"] = prompt
        return DUMMY_JPEG

    monkeypatch.setattr("routers.tryon.call_pro_image_edit", _capture)
    sp = "x" * 1000
    with open(FIXTURE, "rb") as p, open(FIXTURE, "rb") as c:
        response = client.post(
            "/try-on",
            files=[
                ("person", ("p.jpg", p, "image/jpeg")),
                ("clothes", ("c.jpg", c, "image/jpeg")),
            ],
            data={"meta": "{}", "styling_prompt": sp},
        )
    assert response.status_code == 200
    # prompt 에는 정확히 400자만 포함되어야 함
    assert "x" * 400 in captured["prompt"]
    assert "x" * 401 not in captured["prompt"]


def test_tryon_empty_styling_prompt_no_section(client, monkeypatch):
    captured = {}

    def _capture(prompt, images):
        captured["prompt"] = prompt
        return DUMMY_JPEG

    monkeypatch.setattr("routers.tryon.call_pro_image_edit", _capture)
    with open(FIXTURE, "rb") as p, open(FIXTURE, "rb") as c:
        response = client.post(
            "/try-on",
            files=[
                ("person", ("p.jpg", p, "image/jpeg")),
                ("clothes", ("c.jpg", c, "image/jpeg")),
            ],
            data={"meta": "{}", "styling_prompt": ""},
        )
    assert response.status_code == 200
    assert "Styling guide" not in captured["prompt"]
