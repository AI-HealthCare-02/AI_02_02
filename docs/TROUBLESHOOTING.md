# 에러 해결 모음집

> "이런 메시지가 뜨면 > 이렇게 해결하세요"

---

## 에러 1: Docker 한글 경로 에러 (가장 흔함!)

### 이런 메시지가 뜨면

```
error during build: failed to solve: failed to read dockerfile
```

### 이렇게 해결

프로젝트 폴더 경로에 한글이 있으면 Docker가 파일을 못 읽어요.

```powershell
subst X: "C:\Users\mal03\Desktop\레퍼런스\마지막 웹프로젝트"
Set-Location X:\
docker compose -p ai-health-local up -d postgres redis fastapi nginx
```

> 왜?: Docker BuildKit 엔진이 non-ASCII(한글) 경로를 처리 못하는 버그예요.

---

## 에러 2: Redis 연결 실패

### 이런 메시지가 뜨면

```
redis.exceptions.ConnectionError: Error connecting to localhost:6379
```

### 이렇게 해결

```bash
# Redis 컨테이너가 켜져있는지 확인
docker compose -p ai-health-local ps

# 꺼져있으면 다시 시작
docker compose -p ai-health-local up -d redis

# 직접 Redis 연결 테스트
docker compose -p ai-health-local exec redis redis-cli ping
# "PONG" 이 나오면 정상
```

---

## 에러 3: 포트 충돌 (port already allocated)

### 이런 메시지가 뜨면

```
Bind for 0.0.0.0:8000 failed: port is already allocated
```

### 이렇게 해결

```powershell
# 누가 그 포트를 쓰고 있는지 찾기
netstat -ano | findstr :8000

# 해당 프로세스 종료 (PID 번호로)
taskkill /PID <번호> /F

# 또는 Docker 컨테이너가 이미 있으면
docker compose -p ai-health-local down
docker compose -p ai-health-local up -d postgres redis fastapi nginx
```

주요 포트: **80**(nginx), **5432**(postgres), **6379**(redis), **8000**(fastapi)

---

## 에러 4: DB 마이그레이션 실패

### 이런 메시지가 뜨면

```
tortoise.exceptions.OperationalError: relation "users" does not exist
```

### 이렇게 해결

```bash
# 마이그레이션 상태 확인
docker compose -p ai-health-local exec fastapi uv run aerich history

# 마이그레이션 실행
docker compose -p ai-health-local exec fastapi uv run aerich upgrade

# 그래도 안 되면: DB 초기화 (데이터 삭제됨!)
docker compose -p ai-health-local down -v
docker compose -p ai-health-local up -d postgres redis fastapi nginx
```

> `-v` 옵션은 볼륨(데이터)을 삭제해요. **개발 중에만** 쓰세요!

---

## 에러 5: 커밋 훅 거부 (ruff 린트)

### 이런 메시지가 뜨면

```
========================================
  커밋 차단: ruff 린트 에러가 있습니다
========================================
```

### 이렇게 해결

```bash
# 에러 확인
uv run ruff check .

# 자동 수정
uv run ruff check . --fix

# 수정된 파일 다시 스테이징 + 커밋
git add .
git commit -m "✨ feat: 설명"
```

---

## 에러 6: 커밋 메시지 형식 거부

### 이런 메시지가 뜨면

```
========================================
  커밋 메시지 형식이 올바르지 않습니다
========================================
```

### 이렇게 해결

커밋 메시지를 `이모지 타입: 설명` 형식으로 다시 쓰세요.

- 틀린 예: `"수정 완료"`
- 맞는 예: `"🐛 fix: 로그인 토큰 만료시간 수정"`

사용 가능한 타입: feat, fix, chore, style, docs, build, test, refactor, hotfix

---

## 에러 7: Docker Desktop 미실행

### 이런 메시지가 뜨면

```
Cannot connect to the Docker daemon
```

### 이렇게 해결

Docker Desktop을 실행하세요.
Windows 시작 메뉴 > "Docker Desktop" 검색 > 실행
시스템 트레이에 고래 아이콘이 보여야 해요.

---

## 에러 8: uv/ruff 명령어를 못 찾음

### 이런 메시지가 뜨면

```
uv: command not found
```

### 이렇게 해결

```powershell
# uv 설치 (Windows PowerShell)
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

# 프로젝트 의존성 설치 (가상환경 자동 생성)
uv sync --all-groups --frozen
```

---

## 에러 9: npm run dev 실패 (프론트엔드)

### 이런 메시지가 뜨면

```
Module not found: Can't resolve ...
```

### 이렇게 해결

```bash
cd frontend
rm -rf node_modules
npm install
npm run dev
```

---

## 에러 10: OpenAI API 키 에러 (AI 채팅)

### 이런 메시지가 뜨면

```
openai.AuthenticationError: Invalid API key
```

### 이렇게 해결

`.env` 파일에서 `OPENAI_API_KEY` 값을 확인하세요.

- `sk-proj-여기에-실제-키를-넣으세요` 가 그대로 있으면 실제 키로 교체 필요
- 팀장에게 API 키를 받으세요
---

## 오류 11: push 전에 자동 검사에서 막힘

### 이런 메시지가 뜨면

```bash
[pre-push] Running local checks before push...
```

### 의미

저장소에 설정된 `pre-push` 훅이 GitHub Actions와 비슷한 기본 검사를 먼저 돌리고 있다는 뜻입니다.

- `uv run ruff check backend`
- `uv run python -m pytest backend/tests/unit -q`
- frontend 변경이 있으면 `cd frontend && npm run build`

### 해결

실패한 단계의 에러를 먼저 고친 뒤 다시 `git push` 하면 됩니다.

```bash
uv run ruff check backend --fix
uv run python -m pytest backend/tests/unit -q
cd frontend
npm run build
```
