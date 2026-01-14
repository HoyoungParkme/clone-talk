# 주요 흐름

## 1) 업로드 및 화자 선택
1. 사용자가 `front`에서 `.txt` 파일 업로드
2. `POST /api/upload` 호출 → Express 프록시 → FastAPI `/upload`
3. 파일을 임시 경로에 저장하고 백그라운드 작업 시작
4. `backend/parser.py`로 메시지 파싱
5. 화자 목록 추출 → `GET /api/jobs/:job_id`로 폴링
6. 사용자가 대상 화자 선택 후 `POST /api/jobs/:job_id/analyze`

## 2) 페르소나 분석 및 리포트 생성
1. 선택된 화자의 메시지를 추출
2. `generate_persona_report`로 요약/말투/패턴 생성
3. 스타일 예시/대화 예시/시그니처 생성
4. 작업 상태는 `GET /api/jobs/:job_id`로 폴링

## 3) 페르소나 확정 및 벡터 저장
1. 사용자가 리포트 편집 후 `POST /api/persona/confirm`
2. 편집된 프로필을 작업 상태에 반영
3. 원본 파일 재파싱 → 메시지 청크 생성
4. ChromaDB 저장 후 원본 파일 삭제

## 4) 채팅 스트리밍
1. `POST /api/chat/stream` 호출
2. `style_mode`로 프롬프트/ RAG/ 혼합 모드 선택 가능
3. ChromaDB에서 관련 컨텍스트 조회(RAG)
4. 최근 대화 히스토리 + few-shot 예시를 함께 주입
5. OpenAI 스트리밍 응답을 SSE 형식으로 전달
6. 프론트는 `useChatStream`에서 SSE 파싱 후 화면 갱신

## 5) 설정 및 에이전트 폴링
- `GET/POST /api/settings`로 에이전트 활성화 설정
- `GET /api/agent/poll`로 선제 메시지 체크

## 6) 환경 변수
- `OPENAI_API_KEY`: OpenAI API 키 (권장)
- `OPENAI_MODEL`: OpenAI 모델 이름 (기본값: gpt-4o-mini)
- `OPENAI_TEMPERATURE`: 생성 온도 (기본값: 0.3)
- `MEMORY_TURNS`: 최근 대화 유지 턴 수 (기본값: 8)
- `ANTHROPIC_API_KEY`: OpenAI API 키 (이전 명칭 호환)
- `JINA_API_KEY`: Jina Embeddings 키
- `JINA_EMBEDDINGS_MODEL`: Jina 임베딩 모델 이름 (선택)
- `RAG_MAX_DISTANCE`: RAG 거리 임계값 (기본값: 0.85)
- `CHROMA_PATH`: ChromaDB 저장 경로 (선택)
- `PYTHON_CMD`: 파이썬 실행 경로 (Windows 환경에서 필요 시)

## 7) 로컬 실행 흐름
1. `npm run dev` 실행
2. Express 서버가 FastAPI를 하위 프로세스로 실행
3. 브라우저에서 `http://localhost:5000` 접속
