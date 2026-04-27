"""Supabase service-role 클라이언트 — RLS 우회 권한.

서버는 항상 service_role key 로 Supabase 에 접속하고, user_id 는 JWT 에서
명시적으로 주입한다. 클라이언트(앱) 는 service_role key 를 절대 보지 않는다.
"""

from __future__ import annotations

from typing import Optional

from supabase import Client, create_client

from config import settings

_client: Optional[Client] = None


def get_supabase() -> Client:
    """싱글턴 Supabase service-role client 를 반환한다.

    첫 호출 시 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env 가 없으면
    명확한 RuntimeError 를 낸다 — import 시점이 아니라 사용 시점에 검사하므로
    .env 가 비어있는 CI/테스트 환경에서도 모듈 import 자체는 통과.
    """
    global _client
    if _client is None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError(
                "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았다. "
                "server/.env 를 채우거나 테스트에서 mock_supabase fixture 를 사용하라."
            )
        _client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
        )
    return _client


def reset_supabase_client() -> None:
    """테스트 격리용 — 다음 호출에서 client 를 재생성한다."""
    global _client
    _client = None
