# venv 개발 가이드

로컬 개발과 테스트는 venv로 진행합니다.
WSL에서는 Windows에서 만든 `.venv`를 재사용하지 말고 삭제 후 재생성하세요.

## 사전 조건
- Python 3.11 이상

## 1) venv 생성
### WSL/Linux
```bash
python3 -m venv .venv
```

### Windows(PowerShell)
```powershell
python -m venv .venv
```

## 2) 의존성 설치
### WSL/Linux
```bash
npm install
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r backend/requirements.txt
```

### Windows(PowerShell)
```powershell
npm install
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -r backend\requirements.txt
```

## 2-1) 재현성 설치(선택)
`requirements.lock`이 있는 경우 고정 버전을 설치합니다.
### WSL/Linux
```bash
.venv/bin/python -m pip install -r backend/requirements.lock
```

### Windows(PowerShell)
```powershell
.\.venv\Scripts\python -m pip install -r backend\requirements.lock
```

## 3) .env 설정(권장)
프로젝트 루트에 `.env` 파일을 만들고 아래 값을 채워주세요.
```env
OPENAI_API_KEY=your_openai_key
JINA_API_KEY=your_jina_key
CHROMA_PATH=
PYTHON_CMD=
```

## 4) 환경 변수로 설정(선택)
### WSL/Linux
```bash
export OPENAI_API_KEY="your_openai_key"
export ANTHROPIC_API_KEY="your_openai_key"  # 이전 명칭 호환(선택)
export JINA_API_KEY="your_jina_key"
export PYTHON_CMD="$PWD/.venv/bin/python"
```

### Windows(PowerShell)
```powershell
$env:OPENAI_API_KEY="your_openai_key"
$env:ANTHROPIC_API_KEY="your_openai_key"  # 이전 명칭 호환(선택)
$env:JINA_API_KEY="your_jina_key"
$env:PYTHON_CMD="C:\Path\to\python.exe"  # 선택
```

## 5) 실행
```bash
npm run dev
```

## 참고
- Windows에서 `python` 경로가 다를 수 있습니다.
- `PYTHON_CMD`는 Express가 FastAPI를 실행할 때 사용됩니다.
