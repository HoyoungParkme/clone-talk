import os
import logging
from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import uvicorn
import shutil
import uuid
import json
from contextlib import asynccontextmanager

from backend.models import (
    JobResponse, PersonaProfile, ChatRequest, Settings, AgentPollResponse
)
from backend.parser import parse_kakao_talk
from backend.chat import (
    generate_persona_report, 
    confirm_persona_processing, 
    stream_chat_response, 
    get_agent_poll,
    setup_chroma
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_chroma()
    yield
    # Shutdown

app = FastAPI(lifespan=lifespan)

# CORS configuration - Allow all for MVP dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store (MVP)
jobs = {}
settings = Settings(agent_enabled=False)

@app.get("/health")
def health_check():
    return {"ok": True}

@app.post("/upload")
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    job_id = str(uuid.uuid4())
    temp_path = f"/tmp/{job_id}_{file.filename}"
    jobs[job_id] = {
        "job_id": job_id,
        "status": "queued",
        "progress": 0,
        "file_path": temp_path
    }
    
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    background_tasks.add_task(process_upload, job_id)
    return {"job_id": job_id}

async def process_upload(job_id: str):
    try:
        logger.info(f"Background task started for job {job_id}")
        jobs[job_id]["status"] = "running"
        jobs[job_id]["progress"] = 10
        
        file_path = jobs[job_id]["file_path"]
        logger.info(f"Parsing file: {file_path}")
        messages = parse_kakao_talk(file_path)
        logger.info(f"Parsed {len(messages)} messages")
        jobs[job_id]["progress"] = 50
        
        logger.info(f"Generating persona report for job {job_id}")
        report = await generate_persona_report(messages)
        jobs[job_id]["report"] = report
        jobs[job_id]["progress"] = 100
        jobs[job_id]["status"] = "done"
        logger.info(f"Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Error processing job {job_id}: {str(e)}")
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
        # Cleanup on error
        if os.path.exists(jobs[job_id]["file_path"]):
            os.remove(jobs[job_id]["file_path"])

@app.get("/jobs/{job_id}", response_model=JobResponse)
def get_job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]

@app.post("/persona/confirm")
async def confirm_persona(background_tasks: BackgroundTasks, payload: dict):
    job_id = payload.get("job_id")
    profile_data = payload.get("persona_profile")
    
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
        
    background_tasks.add_task(
        confirm_persona_processing, 
        job_id, 
        jobs[job_id]["file_path"], 
        profile_data
    )
    return {"ok": True}

@app.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    return StreamingResponse(
        stream_chat_response(req.session_id, req.message, req.agent_enabled),
        media_type="text/event-stream"
    )

@app.get("/settings", response_model=Settings)
def get_settings():
    return settings

@app.post("/settings", response_model=Settings)
def update_settings(new_settings: Settings):
    global settings
    settings = new_settings
    return settings

@app.get("/agent/poll", response_model=AgentPollResponse)
def agent_poll(session_id: str):
    return get_agent_poll(session_id, settings.agent_enabled)

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
