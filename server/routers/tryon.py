import base64
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from prompts.tryon import TRYON_PROMPT
from schemas import TryOnResponse
from services.gemini import call_pro_image_edit

router = APIRouter()


@router.post("/try-on", response_model=TryOnResponse)
async def try_on(
    person: UploadFile = File(...),
    clothes: List[UploadFile] = File(...),
    meta: str = Form(""),
):
    if not clothes:
        raise HTTPException(status_code=400, detail="옷 이미지가 1장 이상 필요합니다")

    person_bytes = await person.read()
    if not person_bytes:
        raise HTTPException(status_code=400, detail="전신 이미지가 비어있습니다")

    clothing_bytes: list[bytes] = []
    for c in clothes:
        data = await c.read()
        if not data:
            raise HTTPException(status_code=400, detail="빈 옷 이미지가 포함되어 있습니다")
        clothing_bytes.append(data)

    prompt = TRYON_PROMPT + (meta or "")

    try:
        image_bytes = call_pro_image_edit(prompt, [person_bytes, *clothing_bytes])
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Gemini 호출 실패: {exc}")

    if not image_bytes:
        raise HTTPException(status_code=502, detail="Gemini 이미지 응답이 비어있습니다")

    encoded = base64.b64encode(image_bytes).decode("ascii")
    return TryOnResponse(image_base64=encoded, mime="image/jpeg")
