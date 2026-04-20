import json
import re
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile

from prompts.analyze import ANALYZE_PROMPT
from schemas import AnalyzeResponseItem
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


def _coerce_item(raw: dict) -> AnalyzeResponseItem:
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
    return AnalyzeResponseItem(
        category=category,
        colors=[str(c) for c in colors],
        material=material,
        tags=[str(t) for t in tags],
    )


@router.post("/analyze", response_model=List[AnalyzeResponseItem])
async def analyze(files: List[UploadFile] = File(...)):
    if len(files) < 1 or len(files) > 5:
        raise HTTPException(status_code=400, detail="이미지는 1~5장이어야 합니다")

    images: list[bytes] = []
    for f in files:
        data = await f.read()
        if not data:
            raise HTTPException(status_code=400, detail="빈 이미지가 포함되어 있습니다")
        images.append(data)

    try:
        raw_text = call_flash_multimodal(ANALYZE_PROMPT, images)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini 호출 실패: {exc}")

    try:
        parsed = _extract_json_array(raw_text)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Gemini 응답 파싱 실패: {exc}")

    if not isinstance(parsed, list):
        raise HTTPException(status_code=400, detail="응답이 배열이 아닙니다")

    try:
        return [_coerce_item(item) for item in parsed]
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
