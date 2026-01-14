# LastTalk

카카오톡 대화 내보내기 파일을 분석해 특정 인물의 말투와 대화 습관을 재현하는 챗봇입니다.
이 프로젝트의 목적은 정보 제공이 아니라 **그 사람 자체를 닮은 대화 경험**을 만드는 것입니다.

## 목적과 원칙
- 인사이트/정보 전달보다 관계 유지와 감정 반응을 우선합니다.
- 말투/표현/리듬을 실제 대화에 맞게 재현하는 데 집중합니다.
- 이모지는 사용하지 않고, 이모티콘은 자연스러운 수준에서만 사용합니다.

## 핵심 기능
- 카카오톡 `.txt` 파일 업로드 및 파싱
- 화자 선택 후 페르소나 프로필 생성
- 프로필 검토/수정 후 확정
- 스트리밍 채팅(프롬프트/RAG/혼합 모드)
- 세션 기반 최근 대화 메모리 반영(서버 메모리, 재시작 시 초기화)

## 아키텍처
- **Front**: React + Vite (`front/`)
- **API**: FastAPI (`backend/`)
- **Proxy/Server**: Express (`backend/server/`)
- **Vector DB**: ChromaDB (로컬 저장)
- **Embedding**: Jina Embeddings API(선택)
- **LLM**: OpenAI API

## 로컬 실행
### 요구사항
- Node.js 20.x (Dockerfile 기준)
- Python 3.11+ (`docs/venv.md` 기준)

### 설치
```bash
npm install
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r backend/requirements.txt
```

### 재현성 설치(선택)
```bash
.venv/bin/python -m pip install -r backend/requirements.lock
```

### 환경 변수
루트에 `.env` 파일을 생성하고 필요한 값을 채웁니다.
```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.3
MEMORY_TURNS=8
JINA_API_KEY=
JINA_EMBEDDINGS_MODEL=
RAG_MAX_DISTANCE=0.85
CHROMA_PATH=
PYTHON_CMD=
```

### 실행
```bash
npm run dev
```

## 주요 엔드포인트
- `POST /api/upload`: 파일 업로드
- `GET /api/jobs/:job_id`: 작업 상태 폴링
- `POST /api/jobs/:job_id/analyze`: 화자 선택 후 분석 시작
- `POST /api/persona/confirm`: 편집한 페르소나 확정
- `POST /api/chat/stream`: 채팅 스트리밍(SSE)
- `GET /api/settings`: 에이전트 설정 조회
- `POST /api/settings`: 에이전트 설정 수정
- `GET /api/agent/poll`: 선제 메시지 폴링

## 데이터 흐름 요약
1. 파일 업로드 → 파싱
2. 화자 선택 → 페르소나 리포트 생성
3. 리포트 편집 → 확정
4. 메시지 청크 임베딩 → Chroma 저장
5. 채팅 스트리밍 → RAG/프롬프트 기반 응답

## 말투/응답 정책
- 말투는 `honorific_level` 기준으로 강제합니다.
- 답변은 짧고 자연스럽게, 필요 시 질문 1개만 덧붙입니다.
- 정보 제공형 답변보다 관계 유지와 감정 반응을 우선합니다.

## 폴더 구조
```
.
├─ backend/            # FastAPI, 페르소나 로직, 파서
├─ front/              # React UI
├─ config/             # Vite/Tailwind/Drizzle 설정
├─ docs/               # 세부 문서
└─ package.json        # Node 스크립트/의존성
```

## 문서
- `docs/README.md`: 문서 인덱스
- `docs/structure.md`: 파일 구조
- `docs/flow.md`: 처리 흐름
- `docs/system-diagram.md`: 시스템 다이어그램
- `docs/venv.md`: Python venv 가이드
- `docs/docker.md`: Docker 실행 템플릿
- `docs/gcp-vm.md`: GCP VM 배포 가이드

## 문제 해결
- `cross-env: Permission denied`:
  - `rm -rf node_modules package-lock.json && npm install`
- `ModuleNotFoundError: chromadb`:
  - `.venv/bin/python -m pip install -r backend/requirements.txt`
  - `PYTHON_CMD`를 `.venv/bin/python`으로 지정

## 주의사항
- `backend/requirements.lock`은 설치 환경에서 생성한 고정 버전 목록입니다.
- 서버 메모리는 재시작 시 초기화됩니다.
