# GCP VM 배포 가이드

이 문서는 Compute Engine VM에 Docker로 배포하는 최소 구성 가이드입니다.
Cloud Run이 아닌 VM 배포를 기준으로 합니다.

## 권장 VM 구성(비용 최소 기준)
- 머신 타입: e2-small(2GB RAM) 또는 e2-micro(1GB, 불안정 가능)
- OS 이미지: Ubuntu 22.04 LTS (x86/64) 또는 Debian 12 (x86/64)
- 디스크: pd-standard 20~30GB
- 방화벽: tcp:22, tcp:5000(테스트용) 또는 tcp:80/443(운영용)

## 사전 준비
- gcloud CLI 로그인 및 프로젝트 설정
- VM 인스턴스 생성 완료

## 1) SSH 접속
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud compute instances list
gcloud compute ssh YOUR_INSTANCE_NAME --zone YOUR_ZONE
```

## 2) Docker 설치
```bash
sudo apt update
sudo apt install -y docker.io git
sudo usermod -aG docker $USER
exit
```
재접속 후 다음 단계 진행.

## 3) 레포 클론 및 환경 변수 설정
```bash
git clone <YOUR_REPO_URL> lasttalk
cd lasttalk

cat > .env <<'EOF'
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.6
MEMORY_TURNS=8
CHROMA_PATH=/app/backend/data/chroma
EOF
```

## 4) Docker 빌드/실행
```bash
docker build -t lasttalk:latest .
mkdir -p backend/data/chroma
docker run -d --name lasttalk -p 5000:5000 --env-file .env \
  -v "$PWD/backend/data/chroma:/app/backend/data/chroma" lasttalk:latest
```

## 5) 방화벽 설정(외부 접근 필요 시)
```bash
gcloud compute firewall-rules create lasttalk-5000 \
  --allow tcp:5000 \
  --target-tags lasttalk
gcloud compute instances add-tags YOUR_INSTANCE_NAME \
  --zone YOUR_ZONE --tags lasttalk
```

## 6) 헬스 체크
```bash
curl http://localhost:5000/api/health
```

## 운영 팁
- e2-micro 사용 시 메모리 부족 가능성이 높습니다.
- 필요 시 스왑을 추가하세요.
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

## 주의사항
- `backend/data/chroma`는 VM 로컬 디스크에 저장됩니다.
- VM 재시작/교체 시 데이터는 유실될 수 있습니다. [확인 필요]
