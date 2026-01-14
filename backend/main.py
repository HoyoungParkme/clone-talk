"""
모듈명: backend.main
설명: FastAPI 엔드포인트 및 작업 상태 관리

주요 기능:
- 파일 업로드 및 작업 생성
- 페르소나 분석/확정 처리
- 채팅 스트리밍 API 제공
- 설정/폴링 API 제공

의존성:
- fastapi: API 프레임워크
- uvicorn: ASGI 서버
- python-dotenv: 환경 변수 로드
"""

# 1. 표준 라이브러리
import json
import logging
import os
import tempfile
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

# 2. 서드파티 라이브러리
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
import uvicorn

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv(Path(__file__).resolve().parents[1] / ".env", encoding="utf-8-sig")

# 3. 로컬 애플리케이션
from backend.models import (
    JobResponse, PersonaProfile, ChatRequest, Settings, AgentPollResponse
)
from backend.parser import parse_kakao_talk
from backend.chat import (
    generate_persona_report, 
    confirm_persona_processing, 
    stream_chat_response, 
    get_agent_poll,
    extract_style_examples,
    extract_dialog_examples,
    build_style_signature,
    setup_chroma
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 시작 처리
    setup_chroma()
    yield
    # 종료 처리

app = FastAPI(lifespan=lifespan)

# CORS 설정 - MVP 개발용 전체 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 메모리 작업 저장소(MVP)
jobs = {}
settings = Settings(agent_enabled=False)

def _extract_speakers(messages: list[dict]) -> list[str]:
    """
    메시지 목록에서 화자 목록을 추출합니다.

    Args:
        messages: 파싱된 메시지 목록

    Returns:
        list[str]: 정렬된 화자 목록
    """
    speakers = {m.get("speaker") for m in messages if m.get("speaker")}
    return sorted(speakers)

@app.get("/health")
def health_check():
    """
    헬스 체크용 엔드포인트입니다.

    Returns:
        dict: 정상 여부
    """
    return {"ok": True}

@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    업로드 파일을 저장하고 백그라운드 분석 작업을 시작합니다.

    Args:
        background_tasks: FastAPI 백그라운드 작업 관리자
        file: 업로드된 텍스트 파일

    Returns:
        dict: 작업 ID

    Raises:
        HTTPException: 파일이 비어 있거나 저장 실패 시
    """
    job_id = str(uuid.uuid4())
    safe_name = Path(file.filename).name
    temp_path = Path(tempfile.gettempdir()) / f"{job_id}_{safe_name}"
    logger.info("업로드 시작: 파일명=%s", safe_name)
    jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "progress": 0,
        "file_path": str(temp_path),
        "speakers": [],
        "selected_speaker": None,
        "style_examples": [],
        "dialog_examples": [],
        "style_signature": {},
    }
    
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="빈 파일입니다")
        temp_path.write_bytes(contents)
    finally:
        await file.close()
    logger.info("업로드 저장: 경로=%s 크기=%s", temp_path, temp_path.stat().st_size)
        
    background_tasks.add_task(process_upload, job_id)
    return {"job_id": job_id}

async def process_upload(job_id: str):
    """
    업로드 파일을 파싱하고 화자 목록을 추출합니다.

    Args:
        job_id: 작업 ID
    """
    try:
        logger.info("작업 백그라운드 시작: %s", job_id)
        jobs[job_id]["status"] = "running"
        jobs[job_id]["progress"] = 10
        
        file_path = jobs[job_id]["file_path"]
        logger.info("파일 파싱: %s", file_path)
        messages = parse_kakao_talk(file_path)
        logger.info("메시지 %s건 파싱", len(messages))
        speakers = _extract_speakers(messages)
        if not speakers:
            raise ValueError("참여자 목록을 추출할 수 없습니다")

        jobs[job_id]["speakers"] = speakers
        jobs[job_id]["progress"] = 30
        jobs[job_id]["status"] = "awaiting_selection"
        logger.info("참여자 %s명 추출: %s", len(speakers), speakers)
        
    except Exception as e:
        logger.error("작업 처리 오류: %s - %s", job_id, str(e))
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
        # 오류 발생 시 정리
        if os.path.exists(jobs[job_id]["file_path"]):
            os.remove(jobs[job_id]["file_path"])

async def process_analysis(job_id: str, target_speaker: str):
    """
    선택된 화자를 기준으로 페르소나 리포트를 생성합니다.

    Args:
        job_id: 작업 ID
        target_speaker: 분석 대상 화자 이름
    """
    try:
        file_path = jobs[job_id]["file_path"]
        logger.info("페르소나 리포트 생성: %s (%s)", job_id, target_speaker)
        messages = parse_kakao_talk(file_path)
        target_messages = [
            m for m in messages if m.get("speaker") == target_speaker
        ]
        if not target_messages:
            raise ValueError("선택된 화자의 메시지가 없습니다")
        jobs[job_id]["progress"] = 70
        report = await generate_persona_report(target_messages, require_openai=True)
        jobs[job_id]["style_examples"] = extract_style_examples(target_messages, 5)
        jobs[job_id]["dialog_examples"] = extract_dialog_examples(messages, target_speaker, 3)
        jobs[job_id]["style_signature"] = build_style_signature(target_messages)
        jobs[job_id]["report"] = report
        jobs[job_id]["progress"] = 100
        jobs[job_id]["status"] = "done"
        logger.info("작업 완료: %s", job_id)
    except Exception as e:
        logger.error("분석 처리 오류: %s - %s", job_id, str(e))
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)

@app.get(
    "/jobs/{job_id}",
    response_model=JobResponse,
    response_model_exclude_none=True,
)
def get_job(job_id: str):
    """
    작업 상태를 조회합니다.

    Args:
        job_id: 작업 ID

    Returns:
        JobResponse: 작업 상태 데이터

    Raises:
        HTTPException: 작업이 존재하지 않을 때
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    return jobs[job_id]

@app.post("/jobs/{job_id}/analyze")
async def analyze_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    payload: dict
):
    """
    선택된 화자로 분석을 시작합니다.

    Args:
        job_id: 작업 ID
        background_tasks: FastAPI 백그라운드 작업 관리자
        payload: 요청 본문(화자 정보 포함)

    Returns:
        dict: 처리 결과

    Raises:
        HTTPException: 작업 또는 화자 정보가 유효하지 않을 때
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    target_speaker = payload.get("target_speaker")
    if not target_speaker:
        raise HTTPException(status_code=400, detail="target_speaker가 필요합니다")
    speakers = jobs[job_id].get("speakers") or []
    if target_speaker not in speakers:
        raise HTTPException(status_code=400, detail="선택한 화자가 목록에 없습니다")

    jobs[job_id]["selected_speaker"] = target_speaker
    jobs[job_id]["status"] = "running"
    jobs[job_id]["progress"] = 60
    background_tasks.add_task(process_analysis, job_id, target_speaker)
    return {"ok": True}

@app.get("/persona/confirm")
def confirm_persona_hint():
    """
    페르소나 확정 엔드포인트 안내를 반환합니다.

    Returns:
        dict: 안내 메시지 및 필수 파라미터 정보
    """
    return {
        "message": "이 엔드포인트는 POST로 호출해야 합니다.",
        "required": ["job_id", "persona_profile"],
    }

@app.post("/persona/confirm")
async def confirm_persona(background_tasks: BackgroundTasks, payload: dict):
    """
    편집된 페르소나 프로필을 확정하고 메모리 구축을 시작합니다.

    Args:
        background_tasks: FastAPI 백그라운드 작업 관리자
        payload: 작업 ID와 프로필 데이터

    Returns:
        dict: 처리 결과

    Raises:
        HTTPException: 작업이 존재하지 않을 때
    """
    job_id = payload.get("job_id")
    profile_data = payload.get("persona_profile")
    
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")

    if profile_data and jobs[job_id].get("report"):
        jobs[job_id]["report"]["profile"] = profile_data
        
    background_tasks.add_task(
        confirm_persona_processing, 
        job_id, 
        jobs[job_id]["file_path"], 
        profile_data,
        jobs[job_id].get("selected_speaker"),
    )
    return {"ok": True}

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """
    채팅 스트리밍 응답을 반환합니다.

    Args:
        req: 채팅 요청 데이터

    Returns:
        StreamingResponse: SSE 스트리밍 응답

    Raises:
        HTTPException: 작업 상태가 유효하지 않을 때
    """
    if req.job_id not in jobs:
        raise HTTPException(status_code=404, detail="작업을 찾을 수 없습니다")
    job = jobs[req.job_id]
    if job.get("status") != "done" or not job.get("report"):
        raise HTTPException(status_code=400, detail="페르소나 분석이 완료되지 않았습니다")
    return StreamingResponse(
        stream_chat_response(
            req.session_id,
            req.message,
            req.agent_enabled,
            req.job_id,
            job.get("report"),
            job.get("selected_speaker") or "페르소나",
            job.get("style_examples") or [],
            job.get("dialog_examples") or [],
            job.get("style_signature") or {},
            req.style_mode,
        ),
        media_type="text/event-stream"
    )

@app.get("/settings", response_model=Settings)
def get_settings():
    """
    에이전트 설정을 조회합니다.

    Returns:
        Settings: 현재 설정
    """
    return settings

@app.post("/settings", response_model=Settings)
def update_settings(new_settings: Settings):
    """
    에이전트 설정을 갱신합니다.

    Args:
        new_settings: 변경할 설정 값

    Returns:
        Settings: 갱신된 설정
    """
    global settings
    settings = new_settings
    return settings

@app.get("/agent/poll", response_model=AgentPollResponse)
def agent_poll(session_id: str):
    """
    에이전트 선제 메시지 여부를 조회합니다.

    Args:
        session_id: 세션 ID

    Returns:
        AgentPollResponse: 폴링 결과
    """
    return get_agent_poll(session_id, settings.agent_enabled)

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
