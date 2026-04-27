import json
import re
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile

from prompts.detect_multi import DETECT_MULTI_PROMPT
from schemas import DetectMultiItem
from services.gemini import call_flash_multimodal

router = APIRouter()

_ALLOWED_CATEGORIES = {"상의", "하의", "아우터", "원피스", "신발", "악세사리"}
_JSON_ARRAY_RE = re.compile(r"\[.*\]", re.DOTALL)


def _extract_json_array(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    match = _JSON_ARRAY_RE.search(text)
    if not match:
        raise ValueError("JSON 배열을 찾지 못했습니다")
    return json.loads(match.group(0))


def _coerce_box(raw) -> list[int]:
    if not isinstance(raw, list) or len(raw) != 4:
        raise ValueError("box_2d 형식 오류")
    coords = [int(v) for v in raw]
    for v in coords:
        if v < 0 or v > 1000:
            raise ValueError("box_2d 좌표는 0~1000 범위여야 합니다")
    ymin, xmin, ymax, xmax = coords
    if ymax <= ymin or xmax <= xmin:
        raise ValueError("box_2d 좌표가 유효하지 않습니다")
    return coords


def _coerce_item(raw: dict) -> DetectMultiItem:
    category = raw.get("category")
    if category not in _ALLOWED_CATEGORIES:
        raise ValueError(f"유효하지 않은 카테고리: {category}")
    colors = raw.get("colors") or []
    if not isinstance(colors, list):
        colors = []
    tags = raw.get("tags") or []
    if not isinstance(tags, list):
        tags = []
    material = raw.get("material") or ""
    if not isinstance(material, str):
        material = str(material)
    confidence_raw = raw.get("confidence", 0.0)
    try:
        confidence = float(confidence_raw)
    except (TypeError, ValueError):
        confidence = 0.0
    confidence = max(0.0, min(1.0, confidence))
    box_2d = _coerce_box(raw.get("box_2d"))
    return DetectMultiItem(
        category=category,
        colors=[str(c) for c in colors],
        material=material,
        tags=[str(t) for t in tags],
        confidence=confidence,
        box_2d=box_2d,
    )


@router.post("/detect-multi", response_model=List[DetectMultiItem])
async def detect_multi(file: UploadFile = File(...)):
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="빈 이미지입니다")

    try:
        raw_text = call_flash_multimodal(DETECT_MULTI_PROMPT, [data])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini 호출 실패: {exc}")

    try:
        parsed = _extract_json_array(raw_text)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Gemini 응답 파싱 실패: {exc}")

    if not isinstance(parsed, list):
        raise HTTPException(status_code=400, detail="응답이 배열이 아닙니다")

    items: list[DetectMultiItem] = []
    for raw in parsed:
        if not isinstance(raw, dict):
            continue
        try:
            items.append(_coerce_item(raw))
        except ValueError:
            continue
    return items
