import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()

# 모듈 레벨 별칭 — 기존 코드(services/gemini.py)가 이 이름으로 import 한다.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    supabase_url: str
    supabase_service_role_key: str
    google_oauth_client_id: str

    @property
    def supabase_jwks_url(self) -> str:
        # Supabase 의 새 비대칭(ECC P-256) 시스템에서 JWT 검증은 JWKS 로 한다.
        # 옛 HS256 shared-secret 흐름은 사용하지 않으므로 별도 SUPABASE_JWT_SECRET
        # env 변수를 두지 않는다.
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"


def _load_settings() -> Settings:
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        supabase_url=os.getenv("SUPABASE_URL", ""),
        supabase_service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
        google_oauth_client_id=os.getenv("GOOGLE_OAUTH_CLIENT_ID", ""),
    )


# import 시점에는 검증하지 않는다 — 미설정 키는 사용 시점(supabase client 생성,
# JWT 검증 등) 에서 명확한 에러를 던지도록 phase2 에서 처리한다. 그래야 .env 가
# 비어있는 CI/테스트 환경에서도 모듈 import 자체는 통과한다.
settings = _load_settings()
