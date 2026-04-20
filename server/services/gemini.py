"""Gemini API 래퍼.

세 가지 공개 함수를 모듈 레벨로 제공하여 테스트에서 monkeypatch 로 교체 가능하게 한다.
실제 호출 전에 `google.generativeai` 를 지연 import 한다(테스트 환경에서 미설치여도 import 통과).
"""
from __future__ import annotations

import time
from typing import Optional

from config import GEMINI_API_KEY

_TIMEOUT_DEFAULT = 20
_TIMEOUT_IMAGE = 30
_FLASH_TEXT_MODEL = "gemini-2.0-flash"
_FLASH_MULTIMODAL_MODEL = "gemini-2.0-flash"
_PRO_IMAGE_MODEL = "gemini-2.0-flash-exp-image-generation"


def _configure() -> None:
    import google.generativeai as genai

    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    genai.configure(api_key=GEMINI_API_KEY)


def _with_retry(fn, retries: int = 1):
    last_exc: Optional[BaseException] = None
    for attempt in range(retries + 1):
        try:
            return fn()
        except Exception as exc:
            last_exc = exc
            if attempt >= retries:
                break
            time.sleep(0.2)
    assert last_exc is not None
    raise last_exc


def call_flash_text(prompt: str) -> str:
    """Gemini Flash — 텍스트 전용. 응답 문자열 반환."""
    def _do() -> str:
        import google.generativeai as genai

        _configure()
        model = genai.GenerativeModel(_FLASH_TEXT_MODEL)
        response = model.generate_content(
            prompt,
            request_options={"timeout": _TIMEOUT_DEFAULT},
        )
        return (response.text or "").strip()

    return _with_retry(_do)


def call_flash_multimodal(prompt: str, images: list[bytes]) -> str:
    """Gemini Flash — 멀티모달. 이미지 바이트 + 프롬프트 → 텍스트 응답."""
    def _do() -> str:
        import google.generativeai as genai

        _configure()
        model = genai.GenerativeModel(_FLASH_MULTIMODAL_MODEL)
        parts: list = [prompt]
        for img in images:
            parts.append({"mime_type": "image/jpeg", "data": img})
        response = model.generate_content(
            parts,
            request_options={"timeout": _TIMEOUT_DEFAULT},
        )
        return (response.text or "").strip()

    return _with_retry(_do)


def call_pro_image_edit(prompt: str, images: list[bytes]) -> bytes:
    """Gemini Pro 이미지 편집 — 이미지 바이트(JPEG) 반환."""
    def _do() -> bytes:
        import google.generativeai as genai

        _configure()
        model = genai.GenerativeModel(_PRO_IMAGE_MODEL)
        parts: list = [prompt]
        for img in images:
            parts.append({"mime_type": "image/jpeg", "data": img})
        response = model.generate_content(
            parts,
            request_options={"timeout": _TIMEOUT_IMAGE},
        )
        for candidate in getattr(response, "candidates", []) or []:
            content = getattr(candidate, "content", None)
            if content is None:
                continue
            for part in getattr(content, "parts", []) or []:
                inline = getattr(part, "inline_data", None)
                if inline is not None and getattr(inline, "data", None):
                    return bytes(inline.data)
        raise RuntimeError("Gemini 응답에 이미지 데이터가 없습니다")

    return _with_retry(_do)
