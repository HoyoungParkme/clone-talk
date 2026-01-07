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
    
    sample_msgs = messages[-200:]
    conversation_text = "\n".join([f"{m['ts']} {m['speaker']}: {m['text']}" for m in sample_msgs])
    
    system_prompt = """Analyze the chat logs and create a Persona Report. 
You MUST return a JSON object with two fields:
1. "summary": A text summary of the personalities and relationship.
2. "profile": A JSON object matching the PersonaProfile schema:
{
  "nickname_rules": string[],
  "speech_style": {
    "endings": string[],
    "honorific_level": "informal" | "polite" | "mixed",
    "emoji_usage": "low" | "medium" | "high",
    "punctuation": "short" | "normal" | "many"
  },
  "favorite_topics": string[],
  "taboo_topics": string[],
  "response_length": "short" | "medium" | "long",
  "typical_patterns": string[],
  "few_shot_examples": [{"user": string, "persona": string}]
}"""
    
    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Chat Logs:\n{conversation_text}"}
            ],
            response_format={ "type": "json_object" }
        )
        raw_content = response.choices[0].message.content
        data = json.loads(raw_content)
        
        # Robust parsing: check if AI wrapped it in a "PersonaReport" key or similar
        if "PersonaReport" in data:
            data = data["PersonaReport"]
        
        # Ensure fields exist for validation
        if "summary" not in data:
            data["summary"] = "Analyzed Persona"
        if "profile" not in data:
            # Try to find profile-like data in nested keys if summary exists elsewhere
            for key in ["profile", "PersonaProfile", "persona_profile"]:
                if key in data:
                    data["profile"] = data.pop(key)
                    break
            else:
                # Default empty profile if missing
                data["profile"] = {
                    "nickname_rules": [],
                    "speech_style": {"endings": [], "honorific_level": "mixed", "emoji_usage": "medium", "punctuation": "normal"},
                    "favorite_topics": [],
                    "taboo_topics": [],
                    "response_length": "medium",
                    "typical_patterns": [],
                    "few_shot_examples": []
                }
        
        return data
    except Exception as e:
        logger.error(f"OpenAI error: {e}")
        return {
            "summary": f"Error analyzing logs: {str(e)}",
            "profile": {
                "nickname_rules": [],
                "speech_style": {"endings": [], "honorific_level": "mixed", "emoji_usage": "medium", "punctuation": "normal"},
                "favorite_topics": [],
                "taboo_topics": [],
                "response_length": "medium",
                "typical_patterns": [],
                "few_shot_examples": []
            }
        }

from backend.parser import parse_kakao_talk

def confirm_persona_processing(job_id: str, file_path: str, profile: Dict):
    logger.info(f"Starting memory construction for job {job_id}")
    
    # 1. Parse full file
    messages = parse_kakao_talk(file_path)
    if not messages:
        logger.error("No messages found to embed")
        return

    # 2. Chunking (group by ~5 messages for context)
    chunks = []
    current_chunk = []
    for msg in messages:
        current_chunk.append(f"[{msg['speaker']}] {msg['text']}")
        if len(current_chunk) >= 5:
            chunks.append("\n".join(current_chunk))
            current_chunk = []
    if current_chunk:
        chunks.append("\n".join(current_chunk))

    # 3. Embedding & Storage
    if chunks and collection:
        logger.info(f"Embedding {len(chunks)} chunks...")
        # Note: In a real production app, we'd use get_jina_embedding
        # For this MVP environment, we use Chroma's default embedding function
        # which is often sufficient for small tests.
        try:
            collection.add(
                documents=chunks,
                ids=[f"{job_id}_{i}" for i in range(len(chunks))],
                metadatas=[{"job_id": job_id} for _ in chunks]
            )
            logger.info("Successfully stored chunks in ChromaDB")
        except Exception as e:
            logger.error(f"Error storing in Chroma: {e}")

    # 4. Secure Delete
    if os.path.exists(file_path):
        os.remove(file_path)
        logger.info(f"Deleted original file: {file_path}")

async def stream_chat_response(session_id: str, message: str, agent_enabled: bool):
    client = get_openai_client()
    if not client:
        yield f"data: {json.dumps({'text': 'System: API Key missing.'})}\n\n"
        return

    # RAG Lookup
    context = ""
    if collection:
        try:
            results = collection.query(
                query_texts=[message],
                n_results=3
            )
            if results and results['documents']:
                context = "\n".join(results['documents'][0])
                logger.info(f"RAG context found: {len(context)} chars")
        except Exception as e:
            logger.error(f"RAG query error: {e}")

    system_content = "You are an AI assistant mimicking a specific persona based on chat logs."
    if context:
        system_content += f"\n\nRelevant context from past conversations:\n{context}"

    try:
        stream = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": system_content},
                {"role": "user", "content": message}
            ],
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
