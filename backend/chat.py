"""
모듈명: backend.chat
설명: 페르소나 생성, RAG 조회, 채팅 스트리밍 로직

주요 기능:
- 페르소나 리포트 생성 및 보정
- 스타일/대화 예시 추출
- ChromaDB 임베딩 저장/조회
- 채팅 스트리밍 및 대화 히스토리 관리

의존성:
- chromadb: 벡터 DB
- openai: LLM 호출
- requests: 외부 API 호출
"""

# 1. 표준 라이브러리
import json
import logging
import os
import re
import time
from collections import Counter
from pathlib import Path
from typing import List, Dict, Any

# 2. 서드파티 라이브러리
import chromadb
from chromadb.config import Settings as ChromaSettings
import openai
from openai import OpenAI
import requests

# 3. 로컬 애플리케이션
from backend.prompts import build_persona_prompt, build_base_system_prompt
from backend.parser import parse_kakao_talk

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 전역
chroma_client = None
collection = None
openai_client = None

EMOJI_PATTERN = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002700-\U000027BF"
    "\U00002600-\U000026FF"
    "]+",
    flags=re.UNICODE,
)
TOKEN_PATTERN = re.compile(r"[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9]+")
PROFANITY_PATTERN = re.compile(
    r"(씨발|시발|ㅅㅂ|병신|ㅂㅅ|존나|존내|좆|좆같|개새|개놈|미친|미쳤|꺼져|닥쳐)",
    flags=re.IGNORECASE,
)

MEMORY_TURNS = int(os.getenv("MEMORY_TURNS", "8"))
MEMORY_MAX_MESSAGES = max(MEMORY_TURNS * 2, 2)
CHAT_MEMORY: Dict[str, List[Dict[str, str]]] = {}


def setup_chroma():
    """
    ChromaDB 클라이언트를 초기화합니다.
    """
    global chroma_client, collection
    chroma_path = os.getenv("CHROMA_PATH")
    if not chroma_path:
        chroma_path = str(Path(__file__).resolve().parent / "data" / "chroma")
    if not os.path.exists(chroma_path):
        os.makedirs(chroma_path)
    
    chroma_client = chromadb.PersistentClient(path=chroma_path)
    collection = chroma_client.get_or_create_collection(name="lasttalk_memories")

def get_openai_client():
    """
    OpenAI 클라이언트를 생성하거나 반환합니다.

    Returns:
        OpenAI | None: OpenAI 클라이언트
    """
    global openai_client
    if not openai_client:
        # OPENAI_API_KEY를 우선 사용하고, ANTHROPIC_API_KEY는 호환용으로 지원
        api_key = os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
        if api_key:
            openai_client = OpenAI(api_key=api_key)
        else:
            logger.warning(
                "OpenAI API 키가 없습니다. OPENAI_API_KEY 또는 ANTHROPIC_API_KEY를 설정하세요."
            )
    return openai_client

def get_jina_embedding(text_chunks: List[str]):
    """
    Jina Embeddings API로 임베딩을 생성합니다.

    Args:
        text_chunks: 임베딩 대상 텍스트 목록

    Returns:
        List[List[float]]: 임베딩 벡터 목록
    """
    api_key = os.getenv("JINA_API_KEY")
    if not api_key:
        return [[0.0]*768 for _ in text_chunks] # 모의 값
        
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
    return [[0.0]*768 for _ in text_chunks] # 기본값

def _normalize_list(value: Any) -> List[str]:
    """
    값을 문자열 리스트로 정규화합니다.
    """
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item) for item in value if item is not None]
    if isinstance(value, str):
        return [value]
    return []

def _normalize_enum(value: Any, allowed: set, default: str) -> str:
    """
    열거형 값을 검증하고 기본값을 적용합니다.
    """
    if isinstance(value, str) and value in allowed:
        return value
    return default

def _normalize_persona_report(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    페르소나 리포트 구조를 스키마에 맞게 보정합니다.
    """
    if "summary" in data and not isinstance(data["summary"], str):
        data["summary"] = str(data["summary"])

    profile = data.get("profile")
    if not isinstance(profile, dict):
        profile = {}

    profile["nickname_rules"] = _normalize_list(profile.get("nickname_rules"))
    profile["favorite_topics"] = _normalize_list(profile.get("favorite_topics"))
    profile["taboo_topics"] = _normalize_list(profile.get("taboo_topics"))
    profile["typical_patterns"] = _normalize_list(profile.get("typical_patterns"))

    allowed_length = {"short", "medium", "long"}
    profile["response_length"] = _normalize_enum(
        profile.get("response_length"),
        allowed_length,
        "medium",
    )

    speech_style = profile.get("speech_style")
    if not isinstance(speech_style, dict):
        speech_style = {}

    allowed_honorific = {"informal", "polite", "mixed"}
    allowed_emoji = {"low", "medium", "high"}
    allowed_punctuation = {"short", "normal", "many"}
    speech_style = {
        "endings": _normalize_list(speech_style.get("endings")),
        "honorific_level": _normalize_enum(
            speech_style.get("honorific_level"),
            allowed_honorific,
            "mixed",
        ),
        "emoji_usage": _normalize_enum(
            speech_style.get("emoji_usage"),
            allowed_emoji,
            "medium",
        ),
        "punctuation": _normalize_enum(
            speech_style.get("punctuation"),
            allowed_punctuation,
            "normal",
        ),
    }
    profile["speech_style"] = speech_style

    examples = profile.get("few_shot_examples")
    cleaned_examples = []
    if isinstance(examples, list):
        for ex in examples:
            if isinstance(ex, dict) and "user" in ex and "persona" in ex:
                cleaned_examples.append(
                    {"user": str(ex["user"]), "persona": str(ex["persona"])}
                )
    profile["few_shot_examples"] = cleaned_examples

    data["profile"] = profile
    return data

def _get_memory_key(job_id: str | None, session_id: str) -> str:
    """
    작업과 세션을 기준으로 메모리 키를 생성합니다.
    """
    return f"{job_id or 'global'}:{session_id}"

def _get_recent_history(job_id: str | None, session_id: str) -> List[Dict[str, str]]:
    """
    최근 대화 히스토리를 반환합니다.
    """
    if not session_id:
        return []
    key = _get_memory_key(job_id, session_id)
    history = CHAT_MEMORY.get(key, [])
    if not history:
        return []
    return history[-MEMORY_MAX_MESSAGES:]

def _append_history(
    job_id: str | None,
    session_id: str,
    user_message: str,
    assistant_message: str,
) -> None:
    """
    대화 히스토리에 사용자/페르소나 발화를 추가합니다.
    """
    if not session_id:
        return
    if not user_message or not assistant_message:
        return
    key = _get_memory_key(job_id, session_id)
    history = CHAT_MEMORY.get(key, [])
    history.extend(
        [
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": assistant_message},
        ]
    )
    CHAT_MEMORY[key] = history[-MEMORY_MAX_MESSAGES:]

def _build_few_shot_messages(
    dialog_examples: List[Dict[str, str]],
    limit: int = 3,
) -> List[Dict[str, str]]:
    """
    대화 예시를 few-shot 메시지로 변환합니다.
    """
    messages: List[Dict[str, str]] = []
    for example in dialog_examples[:limit]:
        user_text = sanitize_no_emoji((example.get("user") or "").strip())
        persona_text = sanitize_no_emoji((example.get("persona") or "").strip())
        if not user_text or not persona_text:
            continue
        messages.append({"role": "user", "content": user_text})
        messages.append({"role": "assistant", "content": persona_text})
    return messages

def extract_style_examples(messages: List[Dict], count: int = 5) -> List[str]:
    """
    선택된 화자의 실제 발화 예시를 추출합니다.
    """
    texts: List[str] = []
    for msg in messages:
        text = sanitize_no_emoji((msg.get("text") or "").strip())
        if not text:
            continue
        if 2 <= len(text) <= 160:
            texts.append(text)
    if not texts:
        return []

    unique_texts = list(dict.fromkeys(texts))
    sorted_texts = sorted(unique_texts, key=len, reverse=True)
    return sorted_texts[:count]

def extract_dialog_examples(
    messages: List[Dict],
    target_speaker: str,
    count: int = 3,
) -> List[Dict[str, str]]:
    """
    선택된 화자의 실제 대화 쌍(사용자→페르소나)을 추출합니다.
    """
    examples: List[Dict[str, str]] = []
    prev = None
    for msg in messages:
        if msg.get("speaker") == target_speaker and prev:
            if prev.get("speaker") != target_speaker:
                user_text = sanitize_no_emoji((prev.get("text") or "").strip())
                persona_text = sanitize_no_emoji((msg.get("text") or "").strip())
                if user_text and persona_text:
                    examples.append({"user": user_text, "persona": persona_text})
        prev = msg

    unique_examples = []
    seen = set()
    for ex in examples:
        key = (ex["user"], ex["persona"])
        if key in seen:
            continue
        seen.add(key)
        unique_examples.append(ex)
        if len(unique_examples) >= count:
            break
    return unique_examples

def sanitize_no_emoji(text: str) -> str:
    """
    이모지만 제거하고 이모티콘은 유지합니다.
    """
    return EMOJI_PATTERN.sub("", text)

def build_style_signature(messages: List[Dict]) -> Dict[str, Any]:
    """
    말투 시그니처(문장 길이, 어미, 자주 쓰는 단어)를 생성합니다.
    """
    lengths: List[int] = []
    ending_counter: Counter = Counter()
    token_counter: Counter = Counter()

    for msg in messages:
        text = sanitize_no_emoji((msg.get("text") or "").strip())
        if not text:
            continue
        lengths.append(len(text))

        trimmed = re.sub(r"[\\s\"'“”‘’]+$", "", text)
        trimmed = re.sub(r"[\\.!?…]+$", "", trimmed)
        if trimmed:
            ending = trimmed[-2:] if len(trimmed) >= 2 else trimmed
            ending_counter[ending] += 1

        for token in TOKEN_PATTERN.findall(text):
            if len(token) >= 2:
                token_counter[token] += 1

    avg_len = int(sum(lengths) / len(lengths)) if lengths else 0
    top_endings = [item[0] for item in ending_counter.most_common(5)]
    top_tokens = [item[0] for item in token_counter.most_common(6)]

    return {
        "avg_len": avg_len,
        "endings": top_endings,
        "tokens": top_tokens,
    }

def _normalize_keyword_token(token: str) -> str:
    """
    키워드 토큰을 정규화합니다.
    """
    return token.strip().lower()

def _is_valid_keyword(token: str) -> bool:
    """
    키워드 토큰 유효성을 검사합니다.
    """
    if not token or len(token) < 2:
        return False
    if token.isdigit():
        return False
    return True

def _merge_keywords(primary: List[str], fallback: List[str], limit: int) -> List[str]:
    """
    키워드 후보를 중복 없이 병합합니다.
    """
    merged: List[str] = []
    for item in primary + fallback:
        token = _normalize_keyword_token(str(item))
        if not _is_valid_keyword(token):
            continue
        if token not in merged:
            merged.append(token)
        if len(merged) >= limit:
            break
    return merged

def extract_local_keywords(messages: List[Dict], max_terms: int = 8) -> List[str]:
    """
    대화 로그에서 자동으로 키워드를 추출합니다.
    """
    token_counter: Counter = Counter()
    doc_counter: Counter = Counter()
    total_docs = 0
    for msg in messages:
        text = sanitize_no_emoji((msg.get("text") or "").strip())
        if not text:
            continue
        total_docs += 1
        tokens = []
        for raw in TOKEN_PATTERN.findall(text):
            token = _normalize_keyword_token(raw)
            if not _is_valid_keyword(token):
                continue
            token_counter[token] += 1
            tokens.append(token)
        for token in set(tokens):
            doc_counter[token] += 1
    if total_docs == 0:
        return []
    keywords: List[str] = []
    for token, count in token_counter.most_common():
        doc_ratio = doc_counter[token] / total_docs
        if total_docs >= 10 and doc_ratio >= 0.7:
            continue
        if count < 2:
            continue
        keywords.append(token)
        if len(keywords) >= max_terms:
            break
    return keywords

def extract_common_phrases(messages: List[Dict], max_items: int = 10) -> List[str]:
    """
    대화 로그에서 자주 등장하는 짧은 구절을 추출합니다.
    """
    counter: Counter = Counter()
    for msg in messages:
        text = sanitize_no_emoji((msg.get("text") or "").strip())
        if not text:
            continue
        tokens = [
            _normalize_keyword_token(raw)
            for raw in TOKEN_PATTERN.findall(text)
        ]
        tokens = [t for t in tokens if _is_valid_keyword(t)]
        if len(tokens) >= 2:
            for size in (2, 3):
                for idx in range(len(tokens) - size + 1):
                    phrase = " ".join(tokens[idx:idx + size])
                    counter[phrase] += 1
        if 2 <= len(text) <= 40:
            counter[text] += 1
    return [item[0] for item in counter.most_common(max_items)]


def _build_fallback_summary(messages: List[Dict]) -> str:
    """
    OpenAI 미사용 시 사용할 로컬 요약을 생성합니다.
    """
    if not messages:
        return "대화 로그가 비어 있어 요약할 수 없습니다."

    speakers = [m.get("speaker") for m in messages if m.get("speaker")]
    speaker_counts = Counter(speakers)
    top_speaker, top_count = ("알 수 없음", 0)
    if speaker_counts:
        top_speaker, top_count = speaker_counts.most_common(1)[0]

    total = len(messages)
    unique_speakers = len(speaker_counts)
    avg_len = int(sum(len(m.get("text", "")) for m in messages) / max(total, 1))
    last_text = (messages[-1].get("text") or "").strip()
    last_preview = last_text[:40] + "..." if len(last_text) > 40 else last_text

    return (
        f"총 {total}건의 메시지와 {unique_speakers}명의 참여자가 확인되었습니다. "
        f"가장 많이 말한 사람은 {top_speaker}({top_count}건)이며 평균 메시지 길이는 약 {avg_len}자입니다. "
        f"마지막 메시지는 \"{last_preview}\" 입니다."
    )

async def generate_persona_report(messages: List[Dict], require_openai: bool = True):
    """
    대화 로그를 기반으로 페르소나 리포트를 생성합니다.

    Args:
        messages: 파싱된 메시지 목록
        require_openai: OpenAI 키 필수 여부

    Returns:
        Dict[str, Any]: 페르소나 리포트

    Raises:
        RuntimeError: OpenAI 키가 없고 require_openai가 True일 때
    """
    client = get_openai_client()
    fallback_summary = _build_fallback_summary(messages)
    if not client:
        if require_openai:
            raise RuntimeError("OpenAI API 키가 필요합니다.")
        return {
            "summary": f"{fallback_summary} (로컬 요약)",
            "profile": {
                "nickname_rules": ["모크이름"],
                "speech_style": {
                    "endings": ["~요"],
                    "honorific_level": "polite",
                    "emoji_usage": "medium",
                    "punctuation": "normal",
                },
                "favorite_topics": ["코딩"],
                "taboo_topics": ["없음"],
                "response_length": "medium",
                "typical_patterns": ["모크 패턴"],
                "few_shot_examples": [{"user": "안녕", "persona": "안녕하세요"}],
            },
        }
    
    sample_msgs = messages[-200:]
    conversation_text = "\n".join([f"{m['ts']} {m['speaker']}: {m['text']}" for m in sample_msgs])
    
    system_prompt = """채팅 로그를 분석해 페르소나 리포트를 생성하세요.
반드시 JSON 객체만 반환해야 하며, 다음 두 필드를 포함해야 합니다.
1. "summary": 성격과 관계를 요약한 텍스트
2. "profile": PersonaProfile 스키마와 동일한 JSON 객체
요약과 텍스트 항목은 한국어로 작성하세요.
관심 주제/자주 쓰는 표현은 대화 로그에서 실제로 등장한 단어/구절을 우선 사용하세요.
신조어/은어는 원문 그대로 유지하고, 임의로 표준어로 바꾸지 마세요.
관심 주제는 3~8개, 자주 쓰는 표현은 5~10개로 정리하세요.
단, honorific_level/emoji_usage/punctuation/response_length는 스키마 값 그대로 사용하세요.
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
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"대화 로그:\n{conversation_text}"}
            ],
            response_format={ "type": "json_object" }
        )
        raw_content = response.choices[0].message.content
        data = json.loads(raw_content)
        
        # 응답 래핑 키가 있는 경우 보정
        if "PersonaReport" in data:
            data = data["PersonaReport"]

        # 필수 필드 보장
        if "summary" not in data:
            data["summary"] = "페르소나 분석 결과"
        if "profile" not in data:
            # 요약이 다른 키에 있을 수 있어 프로필 후보 키를 탐색
            for key in ["profile", "PersonaProfile", "persona_profile"]:
                if key in data:
                    data["profile"] = data.pop(key)
                    break
            else:
                # 기본 빈 프로필
                data["profile"] = {
                    "nickname_rules": [],
                    "speech_style": {"endings": [], "honorific_level": "mixed", "emoji_usage": "medium", "punctuation": "normal"},
                    "favorite_topics": [],
                    "taboo_topics": [],
                    "response_length": "medium",
                    "typical_patterns": [],
                    "few_shot_examples": []
                }

        normalized = _normalize_persona_report(data)
        auto_topics = extract_local_keywords(messages, 8)
        auto_patterns = extract_common_phrases(messages, 10)
        profile = normalized.get("profile", {})
        if auto_topics:
            profile["favorite_topics"] = auto_topics
        else:
            profile["favorite_topics"] = _merge_keywords(
                profile.get("favorite_topics", []), auto_topics, 8
            )
        if auto_patterns:
            profile["typical_patterns"] = auto_patterns
        else:
            profile["typical_patterns"] = _merge_keywords(
                profile.get("typical_patterns", []), auto_patterns, 10
            )
        normalized["profile"] = profile
        if not normalized.get("summary"):
            normalized["summary"] = fallback_summary
        return normalized
    except Exception as e:
        logger.error(f"OpenAI 오류: {e}")
        if require_openai:
            raise
        return {
            "summary": f"{fallback_summary} (로컬 요약)",
            "profile": {
                "nickname_rules": [],
                "speech_style": {
                    "endings": [],
                    "honorific_level": "mixed",
                    "emoji_usage": "medium",
                    "punctuation": "normal",
                },
                "favorite_topics": [],
                "taboo_topics": [],
                "response_length": "medium",
                "typical_patterns": [],
                "few_shot_examples": [],
            },
        }

def confirm_persona_processing(
    job_id: str,
    file_path: str,
    profile: Dict,
    target_speaker: str | None = None,
):
    """
    확정된 페르소나를 기반으로 메시지 청크를 임베딩 저장합니다.

    Args:
        job_id: 작업 ID
        file_path: 원본 파일 경로
        profile: 페르소나 프로필
        target_speaker: 대상 화자(선택)
    """
    logger.info(f"작업 메모리 구축 시작: {job_id}")
    
    # 1. 전체 파일 파싱
    messages = parse_kakao_talk(file_path)
    if not messages:
        logger.error("임베딩할 메시지가 없습니다")
        return
    if target_speaker:
        messages = [m for m in messages if m.get("speaker") == target_speaker]
        if not messages:
            logger.error("선택된 화자의 메시지가 없습니다: %s", target_speaker)
            return

    # 2. 청크 분할(맥락 유지를 위해 약 5개 메시지 묶음)
    chunks = []
    current_chunk = []
    for msg in messages:
        current_chunk.append(f"[{msg['speaker']}] {msg['text']}")
        if len(current_chunk) >= 5:
            chunks.append("\n".join(current_chunk))
            current_chunk = []
    if current_chunk:
        chunks.append("\n".join(current_chunk))

    # 3. 임베딩 및 저장
    if chunks and collection:
        logger.info(f"{len(chunks)}개 청크 임베딩 중...")
        try:
            embeddings = None
            if os.getenv("JINA_API_KEY"):
                embeddings = get_jina_embedding(chunks)
            collection.add(
                documents=chunks,
                embeddings=embeddings,
                ids=[f"{job_id}_{i}" for i in range(len(chunks))],
                metadatas=[{"job_id": job_id} for _ in chunks]
            )
            logger.info("ChromaDB 저장 완료")
        except Exception as e:
            logger.error(f"Chroma 저장 오류: {e}")

    # 4. 원본 파일 삭제
    if os.path.exists(file_path):
        os.remove(file_path)
        logger.info(f"원본 파일 삭제: {file_path}")

async def stream_chat_response(
    session_id: str,
    message: str,
    agent_enabled: bool,
    job_id: str | None = None,
    persona_report: Dict[str, Any] | None = None,
    speaker_name: str | None = None,
    style_examples: List[str] | None = None,
    dialog_examples: List[Dict[str, str]] | None = None,
    style_signature: Dict[str, Any] | None = None,
    style_mode: str | None = None,
):
    """
    채팅 응답을 스트리밍으로 생성합니다.

    Args:
        session_id: 세션 ID
        message: 사용자 메시지
        agent_enabled: 에이전트 활성화 여부
        job_id: 작업 ID
        persona_report: 페르소나 리포트
        speaker_name: 화자 이름
        style_examples: 말투 예시 목록
        dialog_examples: 대화 예시 목록
        style_signature: 말투 시그니처 정보
        style_mode: 스타일 모드(prompt/rag/hybrid)
    """
    client = get_openai_client()
    if not client:
        yield f"data: {json.dumps({'error': 'OpenAI API 키가 필요합니다.'})}\n\n"
        return

    mode = (style_mode or "hybrid").lower()
    if mode not in {"prompt", "rag", "hybrid"}:
        mode = "hybrid"
    use_rag = mode in {"rag", "hybrid"}
    use_prompt = mode in {"prompt", "hybrid"}

    # RAG 조회
    context = ""
    if use_rag and collection:
        try:
            where_clause = {"job_id": job_id} if job_id else None
            results = None
            if os.getenv("JINA_API_KEY"):
                query_embedding = get_jina_embedding([message])[0]
                results = collection.query(
                    query_embeddings=[query_embedding],
                    n_results=5,
                    where=where_clause,
                )
            else:
                results = collection.query(
                    query_texts=[message],
                    n_results=5,
                    where=where_clause,
                )
            if results and results["documents"]:
                distances = results.get("distances") or [[]]
                min_distance = min(distances[0]) if distances[0] else None
                max_distance = float(os.getenv("RAG_MAX_DISTANCE", "0.85"))
                if min_distance is None or min_distance <= max_distance:
                    context = "\n".join(results["documents"][0])
                    context = sanitize_no_emoji(context)
                logger.info(f"RAG 컨텍스트 길이: {len(context)}자")
        except Exception as e:
            logger.error(f"RAG 조회 오류: {e}")

    if use_prompt and persona_report and speaker_name:
        normalized = _normalize_persona_report(persona_report)
        system_content = build_persona_prompt(
            normalized.get("summary", ""),
            normalized.get("profile", {}),
            speaker_name,
            style_examples or [],
            dialog_examples or [],
            style_signature or {},
        )
    elif speaker_name:
        system_content = (
            f"{build_base_system_prompt()}"
            f"이름은 '{speaker_name}'이다.\n"
        )
    else:
        system_content = build_base_system_prompt()

    if context:
        system_content += (
            "\n\n과거 대화에서 추출한 관련 컨텍스트:\n"
            f"{context}\n"
            "컨텍스트의 말투와 표현을 우선적으로 반영하세요."
        )

    history_messages = _get_recent_history(job_id, session_id)
    few_shot_messages = _build_few_shot_messages(dialog_examples or [])
    messages_payload = [{"role": "system", "content": system_content}]
    if few_shot_messages:
        messages_payload.extend(few_shot_messages)
    if history_messages:
        messages_payload.extend(history_messages)
    messages_payload.append({"role": "user", "content": message})

    try:
        try:
            temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.3"))
        except ValueError:
            temperature = 0.3
        model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        assistant_text = ""
        stream = client.chat.completions.create(
            model=model,
            messages=messages_payload,
            temperature=temperature,
            stream=True
        )
        for chunk in stream:
            if chunk.choices[0].delta.content:
                cleaned = sanitize_no_emoji(chunk.choices[0].delta.content)
                if cleaned:
                    assistant_text += cleaned
                    yield f"data: {json.dumps({'text': cleaned})}\n\n"
        if assistant_text:
            _append_history(job_id, session_id, message, assistant_text)
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
    
    yield f"data: {json.dumps({'done': True})}\n\n"

def get_agent_poll(session_id: str, enabled: bool):
    """
    에이전트 선제 메시지 여부를 반환합니다.

    Args:
        session_id: 세션 ID
        enabled: 에이전트 활성화 여부

    Returns:
        dict: 폴링 결과
    """
    return {"should_send": False}
