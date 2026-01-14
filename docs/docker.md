# Docker 템플릿

로컬 개발 이후 GCP 배포를 위해 Docker 기반 실행을 준비합니다.

## 목표
- Express + FastAPI를 하나의 컨테이너에서 실행
- 프론트 정적 파일은 `npm run build` 결과물 사용
- 런타임에서 Python 백엔드가 함께 구동

## 사용 방법
```bash
docker build -t lasttalk:dev .
docker run -p 5000:5000 -e OPENAI_API_KEY=... -e JINA_API_KEY=... lasttalk:dev
```

## 환경 변수
- `OPENAI_API_KEY`: OpenAI API 키 (권장)
- `ANTHROPIC_API_KEY`: OpenAI API 키 (이전 명칭 호환)
- `OPENAI_MODEL`: OpenAI 모델 이름 (기본값: gpt-4o-mini)
- `OPENAI_TEMPERATURE`: 생성 온도 (기본값: 0.3)
- `MEMORY_TURNS`: 최근 대화 유지 턴 수 (기본값: 8)
- `JINA_API_KEY`: Jina Embeddings 키
- `JINA_EMBEDDINGS_MODEL`: Jina 임베딩 모델 이름 (선택)
- `RAG_MAX_DISTANCE`: RAG 거리 임계값 (기본값: 0.85)
- `CHROMA_PATH`: ChromaDB 저장 경로 (선택)
- `PYTHON_CMD`: 기본값 `python3` (필요 시 변경)

## 배포 참고
- GCP Cloud Run 배포 시 `PORT=5000` 기준으로 동작합니다.
- Cloud Run에서는 컨테이너 내부에서 1개의 포트를 사용해야 합니다.
