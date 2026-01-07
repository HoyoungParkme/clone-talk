import asyncio
import os
import sys
import json
import logging

# Add project root to sys.path
sys.path.append(os.getcwd())

from backend.parser import parse_kakao_talk
from backend import chat
from backend.models import PersonaProfile

async def test_full_pipeline():
    print("--- Starting Pipeline Test ---")
    
    # 1. Setup Chroma
    print("Setting up ChromaDB...")
    chat.setup_chroma()
    
    # 2. Parse Sample File
    sample_path = "attached_assets/KakaoTalk_20260107_1436_05_860_축의금축내는놈_1767764207255.txt"
    print(f"Parsing sample file: {sample_path}")
    messages = parse_kakao_talk(sample_path)
    print(f"Parsed {len(messages)} messages.")
    
    if len(messages) == 0:
        print("Error: No messages parsed!")
        return

    # 3. Process Embedding & Storage
    test_temp = "/tmp/test_upload.txt"
    with open(sample_path, 'rb') as src, open(test_temp, 'wb') as dst:
        dst.write(src.read())
        
    print("Processing embedding and storage via confirm_persona_processing...")
    chat.confirm_persona_processing("test_job", test_temp, {})
    
    print(f"Chroma collection count: {chat.collection.count()}")
    
    # 4. Test RAG query
    print("Verifying RAG Query via chat.collection.query...")
    results = chat.collection.query(query_texts=["박호영은 어디에 살고 싶어해?"], n_results=3)
    print(f"Query Results: {results['documents']}")

    # 5. Test Chat Stream
    print("Testing Chat Stream...")
    # Mocking environment variables for OpenAI if not set (it should be set in environment)
    async for chunk in chat.stream_chat_response("test_session", "박호영은 어디에 살고 싶어해?", False):
        print(f"Response chunk: {chunk}")
            
    print("--- Pipeline Test Complete ---")

if __name__ == "__main__":
    asyncio.run(test_full_pipeline())
