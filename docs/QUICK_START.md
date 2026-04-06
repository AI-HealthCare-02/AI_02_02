# 다나아 프로젝트 빠른 시작 가이드

> 처음 설치: **15~20분** | 다음부터: **2분** (docker compose up만 하면 끝!)

## 이 문서는 뭔가요?

"내 컴퓨터에서 다나아 서버를 켜는 방법"을 처음부터 끝까지 알려주는 문서예요.
요리로 치면 **"주방 세팅하고 첫 요리 해보기"** 가이드입니다.

---

## 0. 시작 전 확인사항 (재료 준비)

### 필수 프로그램

| 프로그램 | 필요 버전 | 확인 명령어 | 설치 링크 |
|---------|----------|------------|----------|
| Docker Desktop | 4.x 이상 | `docker --version` | https://docker.com |
| Git | 2.x 이상 | `git --version` | https://git-scm.com |
| Python | 3.13 이상 | `python --version` | https://python.org |
| uv | 최신 | `uv --version` | https://github.com/astral-sh/uv |
| Node.js | 18 이상 | `node --version` | https://nodejs.org |

> 이게 뜨면 성공!: 각 명령어 실행 시 버전 번호가 나오면 OK

### Docker Desktop 설정 확인

- [ ] Docker Desktop 실행 중 (시스템 트레이에 고래 아이콘 🐳)
- [ ] WSL2 Backend 활성화 (Settings > General > "Use the WSL 2 based engine" 체크)

---

## 1. 프로젝트 받기 (git clone)

```bash
git clone https://github.com/BIJENG/DANAA_project.git
cd DANAA_project
```

> 이게 뜨면 성공!: 폴더 안에 `backend/`, `docker-compose.yml` 등이 보이면 OK

---

## 2. 한글 경로 우회 (Windows 필수!)

### 왜 이걸 해야 하나요?

Docker의 내부 엔진(BuildKit)이 폴더 경로에 **한글이 있으면 파일을 못 읽어요**.

비유: "외국인 택배기사가 한글 주소를 못 읽는 것"과 같아요.
그래서 임시로 **영어 주소(X: 드라이브)**를 만들어 우회합니다.

### 실행 (PowerShell에서)

```powershell
# X: 드라이브로 프로젝트 연결 (가상 주소 생성)
subst X: "C:\Users\mal03\Desktop\레퍼런스\마지막 웹프로젝트"

# X: 드라이브로 이동
Set-Location X:\
```

### 해제 (작업 끝나면)

```powershell
subst X: /d
```

> 주의: 컴퓨터를 재시작하면 `subst` 설정이 사라져요. 매번 다시 해야 해요.
>
> 만약 프로젝트 경로에 한글이 없다면 이 단계는 건너뛰세요!

---

## 3. 환경변수 파일 만들기

```bash
# 예시 파일을 복사해서 내 설정 파일 만들기
cp envs/example.local.env .env
```

### .env에서 꼭 바꿔야 하는 것

| 항목 | 예시 파일 값 | 바꿀 값 | 설명 |
|------|-------------|---------|------|
| OPENAI_API_KEY | sk-proj-여기에-실제-키를-넣으세요 | 팀 공유 키 | AI 채팅에 필요 |
| SECRET_KEY | CHANGE-ME-to-a-random... | 아무 긴 문자열 | 보안 토큰 생성용 |

> 이게 뜨면 성공!: `.env` 파일이 프로젝트 루트에 생기면 OK

---

## 4. Docker로 서버 켜기 (핵심!)

```powershell
# X: 드라이브에서 실행 (2번 단계 완료 전제)
docker compose -p ai-health-local up -d postgres redis fastapi nginx
```

### 처음 실행 시 시간 안내

- 이미지 다운로드: 5~10분 (인터넷 속도에 따라)
- 빌드: 3~5분
- **총 15~20분** 걸릴 수 있어요. 커피 한 잔 하고 오세요

### 다음부터는?

```powershell
docker compose -p ai-health-local up -d
# 30초 이내 시작!
```

---

## 5. 서버 켜졌는지 확인

```bash
docker compose -p ai-health-local ps
```

> 이게 뜨면 성공!: 4개 서비스(postgres, redis, fastapi, nginx) 모두 "Up" 또는 "running"

### 브라우저로 확인

- http://localhost/api/docs 접속 (Nginx 경유)
- 또는 http://localhost:8000/api/docs 접속 (FastAPI 직접)
- Swagger UI 화면이 뜨면 **완전 성공!**

---

## 6. DB 마이그레이션 (테이블 만들기)

```bash
docker compose -p ai-health-local exec fastapi uv run aerich upgrade
```

> 이게 뜨면 성공!: "Success upgrade" 메시지 또는 "Already up to date"

---

## 7. 프론트엔드 켜기 (별도 터미널)

```bash
cd frontend
npm install      # 처음 한 번만
npm run dev      # http://localhost:3000 에서 확인
```

---

## 8. 서버 끄기

```bash
docker compose -p ai-health-local down
```

---

## 자주 만나는 에러

여기서 해결 안 되면 [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)에서 더 많은 에러를 확인하세요.

### "error during build: failed to solve" (한글 경로)

2번 단계의 `subst X:` 를 했는지 확인하세요.

### "port is already allocated" (포트 충돌)

```bash
# 어떤 프로그램이 포트를 쓰고 있는지 확인
netstat -ano | findstr :8000
# 해당 프로그램 종료 후 다시 시도
```

### "Cannot connect to the Docker daemon"

Docker Desktop을 실행하세요. 시스템 트레이에 고래 아이콘이 보여야 해요.

---

## 다음 단계

- 프로젝트 구조 이해하기 > [ARCHITECTURE.md](./ARCHITECTURE.md)
- Git 작업 방법 > [DEVELOPMENT_WORKFLOWS.md](./DEVELOPMENT_WORKFLOWS.md)
- 에러 해결 모음 > [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
