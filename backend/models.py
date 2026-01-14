"""
모듈명: backend.models
설명: API 입출력용 Pydantic 모델 정의

주요 기능:
- 페르소나 프로필/리포트 스키마 정의
- 작업 상태/채팅 요청/설정 스키마 정의

의존성:
- pydantic: 데이터 모델/검증
"""

# 1. 표준 라이브러리
from typing import List, Optional, Dict, Any

# 2. 서드파티 라이브러리
from pydantic import BaseModel

class FewShotExample(BaseModel):
    """사용자-페르소나 예시 대화 스키마"""
    user: str
    persona: str

class PersonaProfile(BaseModel):
    """페르소나 프로필 스키마"""
    nickname_rules: List[str]
    speech_style: Dict[str, Any]
    favorite_topics: List[str]
    taboo_topics: List[str]
    response_length: str
    typical_patterns: List[str]
    few_shot_examples: List[FewShotExample]

class PersonaReport(BaseModel):
    """페르소나 리포트 스키마"""
    summary: str
    profile: PersonaProfile

class JobResponse(BaseModel):
    """작업 상태 응답 스키마"""
    job_id: str
    status: str
    progress: int
    report: Optional[PersonaReport] = None
    error: Optional[str] = None
    speakers: Optional[List[str]] = None
    selected_speaker: Optional[str] = None

class ChatRequest(BaseModel):
    """채팅 요청 스키마"""
    session_id: str
    job_id: str
    message: str
    agent_enabled: bool
    style_mode: str = "hybrid"

class Settings(BaseModel):
    """에이전트 설정 스키마"""
    agent_enabled: bool

class AgentPollResponse(BaseModel):
    """에이전트 폴링 응답 스키마"""
    should_send: bool
    message: Optional[str] = None
