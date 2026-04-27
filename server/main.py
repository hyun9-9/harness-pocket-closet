from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers.analyze import router as analyze_router
from routers.detect import router as detect_router
from routers.recommend import router as recommend_router
from routers.tryon import router as tryon_router
from routers.uploads import router as uploads_router
from routers.users import router as users_router

app = FastAPI(title="pocket-closet")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(analyze_router)
app.include_router(detect_router)
app.include_router(tryon_router)
app.include_router(recommend_router)
app.include_router(uploads_router)
app.include_router(users_router)
