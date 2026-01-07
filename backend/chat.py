import os
import time
import json
import requests
import chromadb
from chromadb.config import Settings as ChromaSettings
from anthropic import Anthropic
from typing import List, Dict
import logging

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Globals
chroma_client = None
collection = None
anthropic_client = None

def setup_chroma():
    global chroma_client, collection
    chroma_path = os.getenv("CHROMA_PATH", "./data/chroma")
    if not os.path.exists(chroma_path):
        os.makedirs(chroma_path)
    
    chroma_client = chromadb.PersistentClient(path=chroma_path)
    collection = chroma_client.get_or_create_collection(name="lasttalk_memories")

def get_anthropic_client():
    global anthropic_client
    if not anthropic_client:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if api_key:
            anthropic_client = Anthropic(api_key=api_key)
    return anthropic_client

def get_jina_embedding(text_chunks: List[str]):
    api_key = os.getenv("JINA_API_KEY")
    if not api_key:
        return [[0.0]*768 for _ in text_chunks] # Mock
        
    url = "https://api.jina.ai/v1/embeddings"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    data = {
        "input": text_chunks,
        "model": os.getenv("JINA_EMBEDDINGS_MODEL", "jina-embeddings-v2-base-en") # or ko
    }
    resp = requests.post(url, headers=headers, json=data)
    if resp.status_code == 200:
        return [item["embedding"] for item in resp.json()["data"]]
    return [[0.0]*768 for _ in text_chunks] # Fallback

async def generate_persona_report(messages: List[Dict]):
    client = get_anthropic_client()
    if not client:
        # Mock Response for MVP without key
        return {
            "summary": "This is a mock summary because ANTHROPIC_API_KEY is missing.",
            "profile": {
                "nickname_rules": ["MockName"],
                "speech_style": {"endings": ["~yo"], "honorific_level": "polite", "emoji_usage": "medium", "punctuation": "normal"},
                "favorite_topics": ["Coding"],
                "taboo_topics": ["None"],
                "response_length": "medium",
                "typical_patterns": ["Mock pattern"],
                "few_shot_examples": [{"user": "Hi", "persona": "Hello"}]
            }
        }
    
    # Construct Prompt
    # Use last 100 messages for analysis
    sample_msgs = messages[-100:]
    conversation_text = "\n".join([f"{m['ts']} {m['speaker']}: {m['text']}" for m in sample_msgs])
    
    system_prompt = """
    Analyze the following chat log and create a Persona Report.
    Output JSON strictly matching the PersonaReport schema.
    """
    
    msg = client.messages.create(
        model=os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20240620"),
        max_tokens=2000,
        system=system_prompt,
        messages=[
            {"role": "user", "content": f"Chat Logs:\n{conversation_text}"}
        ]
    )
    
    # Parse content (assuming simple JSON extract for MVP)
    content = msg.content[0].text
    # Simple cleanup to find JSON
    try:
        import json
        json_start = content.find('{')
        json_end = content.rfind('}') + 1
        json_str = content[json_start:json_end]
        data = json.loads(json_str)
        return data
    except:
        return {"summary": "Error parsing", "profile": {}} # Fallback

def confirm_persona_processing(job_id: str, file_path: str, profile: Dict):
    # 1. Chunking
    # 2. Embedding
    # 3. Chroma Add
    # 4. Delete File
    
    if os.path.exists(file_path):
        os.remove(file_path) # Secure delete immediately for MVP demo
    pass

async def stream_chat_response(session_id: str, message: str, agent_enabled: bool):
    client = get_anthropic_client()
    if not client:
        yield f"data: {json.dumps({'text': 'System: ANTHROPIC_API_KEY missing.'})}\n\n"
        return

    # RAG Lookup (Mock for MVP if chroma empty)
    
    # Prompt Construction with Caching
    system_message = {
        "type": "text", 
        "text": "You are a persona defined by the following profile.",
        "cache_control": {"type": "ephemeral"}
    }
    
    # Stream
    try:
        with client.messages.stream(
            max_tokens=1000,
            model=os.getenv("ANTHROPIC_MODEL", "claude-3-5-sonnet-20240620"),
            system=[system_message],
            messages=[{"role": "user", "content": message}]
        ) as stream:
            for text in stream.text_stream:
                yield f"data: {json.dumps({'text': text})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    yield f"data: {json.dumps({'done': True})}\n\n"

def get_agent_poll(session_id: str, enabled: bool):
    return {"should_send": False}
