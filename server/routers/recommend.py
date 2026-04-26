import json
import re

from fastapi import APIRouter, HTTPException

from prompts.recommend import RECOMMEND_PROMPT
from schemas import RecommendRequest, RecommendResponse
from services.gemini import call_flash_text

router = APIRouter()

_JSON_OBJ_RE = re.compile(r"\{.*\}", re.DOTALL)


def _extract_json_object(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
    match = _JSON_OBJ_RE.search(text)
    if not match:
        raise ValueError("JSON 오브젝트를 찾지 못했습니다")
    return json.loads(match.group(0))


@router.post("/recommend", response_model=RecommendResponse)
def recommend(body: RecommendRequest) -> RecommendResponse:
    payload = {
        "occasion": body.occasion,
        "clothes": [c.model_dump() for c in body.clothes],
    }
    prompt = RECOMMEND_PROMPT + json.dumps(payload, ensure_ascii=False)

    try:
        raw = call_flash_text(prompt)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini 호출 실패: {exc}")

    try:
        parsed = _extract_json_object(raw)
    except (ValueError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail=f"Gemini 응답 파싱 실패: {exc}")

    combinations = parsed.get("combinations") or []
    if not isinstance(combinations, list):
        raise HTTPException(status_code=400, detail="combinations 가 배열이 아닙니다")
    combinations = combinations[:3]

    sanitized: list[dict] = []
    for combo in combinations:
        if not isinstance(combo, dict):
            continue
        sp = combo.get("styling_prompt", "")
        if not isinstance(sp, str):
            sp = ""
        combo["styling_prompt"] = sp[:400]
        sanitized.append(combo)

    try:
        return RecommendResponse.model_validate({"combinations": sanitized})
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"응답 스키마 불일치: {exc}")
