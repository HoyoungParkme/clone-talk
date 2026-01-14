# LastTalk - 카카오톡 대화 페르소나 생성기

## 개요

LastTalk은 카카오톡 대화 내보내기 파일을 분석해 **그 사람의 말투와 대화 습관을 재현하는** 인공지능 페르소나를 생성하는 웹 애플리케이션입니다. 사용자가 한국어 대화 로그를 업로드하면, 시스템이 메시지를 파싱·분석해 페르소나 프로필을 만들고, 생성된 페르소나와 대화할 수 있는 인터랙티브 채팅 화면을 제공합니다.

이 애플리케이션은 React 프론트엔드, Express.js 미들웨어 서버, Python FastAPI 백엔드(인공지능 처리)로 구성된 하이브리드 아키텍처를 사용합니다.

## 목표와 비목표
### 목표
- 말투/표현/리듬을 실제 대화처럼 재현
- 관계 유지와 감정 반응 중심의 대화 경험 제공

### 비목표
- 지식/정보 제공 위주의 답변
- 상담/해설 중심의 응답

## 응답 정책

- 간단하고 일상적인 표현을 유지합니다.
- 이모지는 사용하지 않고, 이모티콘은 과하지 않게 사용합니다.
- 답변은 짧고 자연스럽게, 필요 시 질문 1개만 덧붙입니다.
- `honorific_level`에 따라 존댓말/반말 규칙을 강제합니다.

## 시스템 아키텍처

### 프론트엔드 아키텍처
- **프레임워크**: React 18 + TypeScript
- **라우팅**: Wouter (React Router의 경량 대안)
- **상태 관리**: TanStack React Query (서버 상태)
- **스타일링**: Tailwind CSS + shadcn/ui 컴포넌트 라이브러리
- **애니메이션**: Framer Motion (부드러운 전환)
- **빌드 도구**: Vite (개발용 Replit 플러그인 포함)

프론트엔드는 페이지 기반 구조이며 4개의 주요 화면으로 구성됩니다:
1. Home - 파일 업로드 화면
2. Processing - 작업 진행률 모니터링
3. Review - 페르소나 프로필 편집
4. Chat - 인공지능 페르소나와의 대화 화면

### 백엔드 아키텍처
- **주 API**: Python FastAPI (포트 8000)
- **미들웨어**: Express.js 서버가 `/api` 요청을 파이썬 백엔드로 프록시
- **프로세스 관리**: Node.js가 파이썬 백엔드를 자식 프로세스로 실행

Express 서버의 역할:
1. FastAPI 백엔드로 API 요청 프록시
2. Vite 개발 서버 또는 프로덕션 정적 파일 제공

### 데이터 흐름
1. 사용자가 카카오톡 `.txt` 내보내기 파일 업로드
2. 백엔드가 채팅 포맷을 파싱 (여러 한국어 내보내기 포맷 지원)
3. 화자 선택 후 페르소나 프로필 생성
4. 편집된 프로필 확정 → 메시지 청크 임베딩 저장
5. ChromaDB에 임베딩 저장 (RAG 검색)
6. 최근 대화 히스토리를 함께 주입
7. OpenAI가 채팅 응답 생성 → 스트리밍 전달

### 데이터 저장
- **벡터 DB**: ChromaDB (영속 저장, `./backend/data/chroma`)
- **작업/설정 저장소**: 메모리 딕셔너리 (MVP 방식)
- **세션 대화 메모리**: 서버 메모리 기반(재시작 시 초기화)
- **사용자 저장소**: 메모리 Map (추후 DB 마이그레이션 인터페이스)
- **세션 관리**: UUID 기반 세션 ID로 대화 연속성 유지

### API 설계
- REST 엔드포인트는 `backend/shared/routes.ts`에 정의
- 요청/응답 검증은 `backend/shared/schema.ts`의 Zod 스키마 사용
- 채팅 스트리밍은 POST 방식 (SSE EventSource 미사용)

주요 엔드포인트:
- `POST /api/upload` - 채팅 파일 업로드, job_id 반환
- `GET /api/jobs/:job_id` - 작업 상태 및 진행률 폴링
- `POST /api/jobs/:job_id/analyze` - 화자 선택 후 분석 시작
- `POST /api/persona/confirm` - 편집된 페르소나 프로필 저장
- `POST /api/chat/stream` - 채팅 스트리밍 응답
- `GET /api/settings` - 설정 조회
- `POST /api/settings` - 설정 갱신
- `GET /api/agent/poll` - 에이전트 선제 메시지 확인

## 외부 의존성

### 인공지능 서비스
- **OpenAI API**: 페르소나 생성 및 채팅 응답 (권장 키: `OPENAI_API_KEY`, 호환 키: `ANTHROPIC_API_KEY`)
- **Jina AI Embeddings API**: RAG 검색용 임베딩 생성 (`JINA_API_KEY`)

### 데이터베이스
- **PostgreSQL**: Drizzle ORM 기반(추후 사용자 데이터 저장), `DATABASE_URL` 필요
- **ChromaDB**: 채팅 메모리 조회용 로컬 영속 벡터 스토어

### 프론트엔드 라이브러리
- shadcn/ui 컴포넌트 전체 세트 (Radix primitives)
- TanStack React Query (데이터 패칭)
- Framer Motion (애니메이션)
- Wouter (라우팅)

### 백엔드 라이브러리
- FastAPI + Uvicorn (Python API)
- ChromaDB (벡터 저장)
- Pydantic (데이터 검증)
- python-multipart (파일 업로드)
