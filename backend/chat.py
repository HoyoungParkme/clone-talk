import os
import time
import json
import requests
import chromadb
from chromadb.config import Settings as ChromaSettings
import openai
from openai import OpenAI
from typing import List, Dict
import logging

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Globals
chroma_client = None
collection = None
openai_client = None

def setup_chroma():
    global chroma_client, collection
    chroma_path = os.getenv("CHROMA_PATH", "./data/chroma")
    if not os.path.exists(chroma_path):
        os.makedirs(chroma_path)
    
    chroma_client = chromadb.PersistentClient(path=chroma_path)
    collection = chroma_client.get_or_create_collection(name="lasttalk_memories")

def get_openai_client():
    global openai_client
    if not openai_client:
        # User explicitly stated ANTHROPIC_API_KEY actually contains an OpenAI key for now
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if api_key:
            openai_client = OpenAI(api_key=api_key)
    return openai_client

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
        "model": os.getenv("JINA_EMBEDDINGS_MODEL", "jina-embeddings-v2-base-en")
    }
    resp = requests.post(url, headers=headers, json=data)
    if resp.status_code == 200:
        return [item["embedding"] for item in resp.json()["data"]]
    return [[0.0]*768 for _ in text_chunks] # Fallback

async def generate_persona_report(messages: List[Dict]):
    client = get_openai_client()
    if not client:
        return {
            "summary": "This is a mock summary because API key is missing.",
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
    
    sample_msgs = messages[-100:]
    conversation_text = "\n".join([f"{m['ts']} {m['speaker']}: {m['text']}" for m in sample_msgs])
    
    system_prompt = "Analyze the following chat log and create a Persona Report. Output JSON strictly matching the PersonaReport schema."
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Chat Logs:\n{conversation_text}"}
            ],
            response_format={ "type": "json_object" }
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        logger.error(f"OpenAI error: {e}")
        return {"summary": f"Error parsing: {str(e)}", "profile": {}}

def confirm_persona_processing(job_id: str, file_path: str, profile: Dict):
    if os.path.exists(file_path):
        os.remove(file_path)
    pass

async def stream_chat_response(session_id: str, message: str, agent_enabled: bool):
    client = get_openai_client()
    if not client:
        yield f"data: {json.dumps({'text': 'System: API Key missing.'})}\n\n"
        return

    try:
        stream = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": message}],
            stream=True
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                yield f"data: {json.dumps({'text': chunk.choices[0].delta.content})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    yield f"data: {json.dumps({'done': True})}\n\n"

def get_agent_poll(session_id: str, enabled: bool):
    return {"should_send": False}
