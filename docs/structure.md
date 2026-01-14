# 파일 구조

프로젝트는 `backend/`(API + 미들웨어)와 `front/`(웹 UI)로 분리되어 있습니다.

```
.
├─ README.md                 # 프로젝트 개요/실행 가이드
├─ backend/
│  ├─ main.py                # FastAPI 엔드포인트
│  ├─ chat.py                # 페르소나 생성/채팅 스트리밍/벡터 저장
│  ├─ parser.py              # 카카오톡 로그 파싱
│  ├─ prompts.py             # 시스템 프롬프트 템플릿
│  ├─ models.py              # Pydantic 모델
│  ├─ server/                # Express 미들웨어 (프록시 + Vite)
│  ├─ shared/                # Zod 스키마 및 공통 라우트 정의
│  └─ script/                # 빌드 스크립트
├─ front/
│  ├─ index.html             # 프론트 엔트리
│  └─ src/
│     ├─ App.tsx             # 라우팅
│     ├─ pages/              # Home/Processing/Review/Chat
│     ├─ hooks/              # API 훅, 스트리밍 처리
│     └─ components/         # UI 컴포넌트
├─ config/
│  ├─ vite.config.ts         # Vite 설정
│  ├─ tsconfig.json          # TypeScript 설정
│  ├─ tailwind.config.ts     # Tailwind 설정
│  ├─ postcss.config.js      # PostCSS 설정
│  ├─ drizzle.config.ts      # Drizzle 설정
│  └─ components.json        # shadcn/ui 설정
├─ docs/                     # 문서
├─ Dockerfile                # 컨테이너 실행 템플릿
├─ .env.example              # 환경 변수 예시
├─ package.json              # Node 스크립트 및 의존성
└─ package-lock.json         # Node 의존성 잠금
```

## 생성/무시되는 폴더
- `node_modules/`: Node 의존성 설치 결과
- `.venv/`: Python 가상환경
- `dist/`: 빌드 산출물
- `backend/data/chroma`: ChromaDB 저장 경로(기본값)

핵심 의존성은 `package.json`과 `backend/requirements.txt`에 정의되어 있습니다.
