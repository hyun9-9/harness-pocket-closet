from typing import Literal, Optional

from pydantic import BaseModel, Field

Category = Literal["상의", "하의", "아우터", "원피스", "신발", "악세사리"]


class AnalyzeResponseItem(BaseModel):
    category: Category
    colors: list[str] = Field(default_factory=list)
    material: str = ""
    tags: list[str] = Field(default_factory=list)


class TryOnResponse(BaseModel):
    image_base64: str
    mime: Literal["image/jpeg"] = "image/jpeg"


class RecommendClothingMeta(BaseModel):
    id: str
    category: str
    colors: list[str] = Field(default_factory=list)
    material: str = ""
    tags: list[str] = Field(default_factory=list)


class RecommendRequest(BaseModel):
    occasion: str
    clothes: list[RecommendClothingMeta]


class RecommendCombination(BaseModel):
    clothing_ids: list[str]
    comment: str
    styling_prompt: str = ""


class RecommendResponse(BaseModel):
    combinations: list[RecommendCombination]


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
