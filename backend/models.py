from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class PersonaProfile(BaseModel):
    nickname_rules: List[str]
    speech_style: Dict[str, Any]
    favorite_topics: List[str]
    taboo_topics: List[str]
    response_length: str
    typical_patterns: List[str]
    few_shot_examples: List[Dict[str, str]]

class PersonaReport(BaseModel):
    summary: str
    profile: PersonaProfile

class JobResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    report: Optional[PersonaReport] = None
    error: Optional[str] = None

class ChatRequest(BaseModel):
    session_id: str
    message: str
    agent_enabled: bool

class Settings(BaseModel):
    agent_enabled: bool

class AgentPollResponse(BaseModel):
    should_send: bool
    message: Optional[str] = None
