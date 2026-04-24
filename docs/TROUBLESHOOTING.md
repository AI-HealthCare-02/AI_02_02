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

---

## 에러 12: 소셜 로그인 후 nginx 404 — `/social-auth` 브릿지 페이지 차단

### 상황

프로덕션 배포 후 카카오/구글/네이버 소셜 로그인을 테스트했을 때,
소셜 플랫폼 인증 자체는 정상적으로 완료되는데 그 이후 화면에서 아래와 같이 nginx 404가 떴다.

```
404 Not Found
nginx
```

### 원인 분석

소셜 로그인 흐름을 단계별로 추적했다.

1. 프론트(Vercel)에서 `/api/v1/auth/kakao/start` 호출 → nginx가 FastAPI로 프록시 → 카카오 인증 페이지로 302 리다이렉트 ✅
2. 카카오 인증 완료 후 `/api/v1/auth/social/callback/kakao?code=...` 호출 → FastAPI가 토큰 발급 후 `/social-auth?access_token=...`으로 302 리다이렉트 ✅
3. 브라우저가 `https://danaa.r-e.kr/social-auth?access_token=...` 요청 → **nginx 404** ❌

nginx 로그로 정확히 확인:
```
GET /api/v1/auth/social/callback/kakao?code=... HTTP/1.1" 302 0
GET /social-auth?access_token=eyJhbGci... HTTP/1.1" 404 548
```

`/social-auth`는 프론트엔드(Vercel)에 있는 페이지인데, nginx `default.conf`의 `location /` 블록이 `return 404`로 막혀 있었다. API 요청(`/api/`)만 FastAPI로 프록시하고 나머지는 전부 404를 반환하도록 설계되어 있었던 것이다. 로컬 개발 환경에서는 프론트를 `npm run dev`로 직접 실행하기 때문에 이 문제가 드러나지 않았고, 프론트가 Vercel에 분리 배포된 프로덕션 환경에서만 발생했다.

### 해결

nginx가 `/api/` 이외의 요청은 Vercel로 프록시하도록 443 블록의 `location /`를 수정했다.

```nginx
# 수정 전 — 모든 비API 요청을 차단
location / {
    return 404;
}

# 수정 후 — Vercel로 프록시
location / {
    proxy_pass https://danaa-project.vercel.app;
    proxy_set_header Host danaa-project.vercel.app;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

```bash
cd ~/project
docker compose -f docker-compose.prod.yml --env-file envs/.prod.env restart nginx
```

수정 후 nginx 로그에서 `/social-auth` 요청이 정상적으로 통과되는 것을 확인했고, 카카오/구글/네이버 세 가지 소셜 로그인 모두 정상 동작했다.

### 배운 점

- nginx는 API 게이트웨이 역할만 한다고 생각했는데, 소셜 로그인 콜백 리다이렉트 흐름에서 프론트 페이지 요청도 nginx를 거친다는 것을 놓쳤다.
- 로컬과 프로덕션의 아키텍처 차이(프론트 직접 실행 vs Vercel 분리 배포)가 이런 종류의 버그를 숨긴다. 배포 전에 전체 인증 흐름을 프로덕션 아키텍처 기준으로 한 번 더 검토해야 한다.

---

## 에러 13: EC2 SSH 접속 타임아웃 — Elastic IP vs 동적 퍼블릭 IP 혼동

### 상황

EC2 서버에 SSH로 접속하려 했을 때 아래 에러가 발생했다.

```
ssh: connect to host 43.202.56.216 port 22: Connection timed out
```

### 원인 분석

AWS EC2 인스턴스는 기본적으로 **동적 퍼블릭 IP**를 사용한다. 인스턴스를 중지했다가 다시 시작하면 IP가 바뀐다. 팀에서 초기에 사용하던 IP(`43.202.56.216`)는 인스턴스 재시작 이후 더 이상 유효하지 않은 상태였다.

이후 **Elastic IP**(`15.165.1.254`)를 인스턴스에 연결해두었는데, 일부 팀원이 이전 IP를 그대로 사용하고 있어서 접속이 안 됐다. Elastic IP는 인스턴스를 재시작해도 변하지 않는 고정 IP다.

### 해결

Elastic IP로 접속:
```bash
ssh -i C:\.ssh\DANAA_ssh_key.pem ubuntu@15.165.1.254
```

현재 연결된 Elastic IP는 AWS 콘솔에서 확인 가능:
> AWS Console → EC2 → Network & Security → Elastic IPs

### 배운 점

- EC2를 처음 세팅할 때 Elastic IP를 바로 할당하고 팀 전체에 공유해야 한다. 동적 IP를 쓰다가 나중에 바꾸면 팀원들이 혼란스럽다.
- SSH 키 파일 경로(`C:\.ssh\DANAA_ssh_key.pem`)도 팀 문서에 명시해두는 것이 좋다.

---

## 에러 14: EC2에서 nginx 설정 파일 편집 시 명령어가 파일 내용으로 기록되는 문제

### 상황

nginx `default.conf`를 수정하기 위해 `sudo tee ... << 'EOF'` 명령어를 터미널에 붙여넣었는데,
`cat ~/project/nginx/default.conf`로 확인해보니 파일 안에 shell 명령어가 그대로 들어가 있었다.

```
    location / {
        return 404;
    }
sudo tee ~/project/nginx/default.conf << 'EOF'
upstream fastapi {
    server fastapi:8000;
...
```

### 원인 분석

`sudo tee` 명령어를 붙여넣을 때 터미널이 명령어 전체를 한 번에 처리하지 못하고 일부가 이전에 열려 있던 파일 스트림에 그대로 기록됐다. heredoc(`<< 'EOF'`) 방식은 터미널 환경에 따라 붙여넣기 시 예상치 못한 동작을 할 수 있다.

### 해결

기존 파일을 완전히 삭제한 뒤 `cat >` 방식으로 새로 작성했다.

```bash
# 1. 기존 파일 삭제
sudo rm ~/project/nginx/default.conf

# 2. cat > 방식으로 새로 작성 (전체 내용을 한 번에 붙여넣기)
cat > ~/project/nginx/default.conf << 'EOF'
... (설정 내용)
EOF

# 3. 반드시 내용 확인
cat ~/project/nginx/default.conf
```

파일 내용이 정상인지 확인한 뒤 nginx를 재시작했다.

```bash
docker compose -f docker-compose.prod.yml --env-file envs/.prod.env restart nginx
docker logs nginx --tail=10
```

### 배운 점

- 서버에서 설정 파일을 직접 편집할 때는 `nano`나 `vim`으로 직접 열어서 수정하는 것이 가장 안전하다.
- `cat >` 또는 `tee` 방식으로 파일을 덮어쓸 때는 반드시 `cat 파일명`으로 결과를 확인하는 습관이 필요하다.
- 설정 파일 변경 전에 `cp default.conf default.conf.bak`으로 백업을 먼저 만들어두면 실수해도 빠르게 복구할 수 있다.

---

## 에러 15: EC2 디스크 용량 부족으로 Docker 이미지 배포 실패

### 상황

GitHub Actions로 새 이미지를 빌드하고 EC2에서 `docker compose pull`을 실행했을 때 배포가 실패했다. EC2 시스템 정보를 확인해보니 디스크 사용률이 **83.6% (6.71GB 중 약 5.6GB 사용)** 였다.

```
no space left on device
```

### 원인 분석

EC2 인스턴스의 기본 루트 볼륨이 8GB로 작게 설정되어 있었다. Docker를 운영하다 보면 이미지가 계속 쌓인다.

- 배포할 때마다 새 이미지(`ghcr.io/bijeng/danaa-fastapi:latest`)를 pull 받는데, 이전 이미지가 자동으로 삭제되지 않고 `<none>` 태그로 남는다.
- PostgreSQL, Redis, nginx, certbot 이미지도 각각 공간을 차지한다.
- 로그 파일, 임시 파일도 누적된다.

`docker system df`로 확인하면 어디서 공간을 차지하는지 볼 수 있다:
```bash
docker system df
# TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
# Images          8         5         3.2GB     1.8GB (56%)
# Containers      5         5         ...
```

### 해결

**즉시 해결 — 미사용 Docker 리소스 정리:**
```bash
# 중지된 컨테이너, 미사용 이미지, 네트워크, 캐시 전체 삭제
docker system prune -af

# 정리 후 디스크 사용량 확인
df -h
```

**근본 해결 — EBS 볼륨 확장 (권장):**

1. AWS Console → EC2 → Elastic Block Store → Volumes
2. 인스턴스에 연결된 볼륨 선택 → Actions → Modify Volume
3. Size를 8 → 30으로 변경 후 Modify
4. EC2 내부에서 파티션 및 파일시스템 확장:
```bash
sudo growpart /dev/xvda 1
sudo resize2fs /dev/xvda1
df -h  # 확장 확인
```

### 배운 점

- EC2 인스턴스 초기 세팅 시 Docker를 운영할 것이라면 루트 볼륨을 최소 30GB로 설정해야 한다. 8GB는 너무 작다.
- 정기적으로 `docker system prune`을 실행하거나 cron으로 자동화하는 것이 좋다.
- 배포 파이프라인에 디스크 사용량 체크 단계를 추가하면 이런 상황을 사전에 감지할 수 있다.

---

## 에러 16: Aerich DB 마이그레이션 포맷 불일치 오류

### 상황

팀원이 새 마이그레이션 파일을 추가한 PR을 pull 받은 후 `aerich upgrade`를 실행했을 때 아래 에러가 발생했다.

```
Old format of migration file detected, run aerich fix-migrations to upgrade format
```

### 원인 분석

Aerich는 마이그레이션 파일의 포맷 버전을 관리한다. 팀원이 다른 버전의 Aerich로 마이그레이션 파일을 생성했거나, 로컬 DB의 Aerich 상태 테이블(`aerich`)이 새 파일 포맷과 맞지 않을 때 발생한다.

이번 케이스는 당뇨 위험도 예측 모델 출력 필드(`predicted_score_pct`, `predicted_risk_level`, `predicted_risk_label`, `predicted_stage_label`, `model_track`)를 `risk_assessments` 테이블에 추가하는 마이그레이션이었다:
```
5_20260415113000_add_model_prediction_fields_to_risk_assessments.py
```

### 해결

```bash
# 1. 마이그레이션 파일 포맷 자동 수정
docker compose exec fastapi uv run aerich fix-migrations

# 2. 마이그레이션 적용
docker compose exec fastapi uv run aerich upgrade
```

정상 출력:
```
Success upgrading to 5_20260415113000_add_model_prediction_fields_to_risk_assessments.py
```

적용 후 실제 DB 컬럼이 추가됐는지 확인:
```bash
docker compose exec postgres psql -U postgres -d ai_health -c "\d risk_assessments"
```

### 배운 점

- 팀 협업 시 PR을 pull 받은 후에는 항상 `aerich upgrade`를 실행해야 한다. 마이그레이션을 빠뜨리면 API가 DB 컬럼을 찾지 못해 런타임 에러가 발생한다.
- `aerich fix-migrations`는 포맷 불일치를 자동으로 수정해주지만, 근본적으로는 팀 전체가 동일한 버전의 Aerich를 사용하는 것이 중요하다. `pyproject.toml`에 버전을 고정해두는 이유가 여기 있다.
## 2026-04-22: Web Push 알림이 오지 않을 때

### 증상

- 설정에서 브라우저 백그라운드 알림을 켰는데 오른쪽 아래 알림이 뜨지 않음
- `push_subscriptions` 테이블에 row가 없거나, row는 있는데 발송이 안 됨
- 알림은 뜨지만 클릭해도 질문 카드로 이동하지 않음

### 확인 순서

1. 백엔드 env 확인

```dotenv
WEB_PUSH_ENABLED=true
WEB_PUSH_VAPID_PUBLIC_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY=
WEB_PUSH_VAPID_PRIVATE_KEY_B64=
WEB_PUSH_VAPID_SUBJECT=mailto:admin@example.com
WEB_PUSH_ACTION_API_BASE=
```

`WEB_PUSH_VAPID_PRIVATE_KEY` 또는 `WEB_PUSH_VAPID_PRIVATE_KEY_B64` 중 하나는 실제 값이 있어야 합니다. GitHub에는 실제 키를 올리지 않습니다.

2. 마이그레이션 확인

```bash
docker compose up -d --build fastapi
docker compose exec fastapi uv run aerich fix-migrations
docker compose exec fastapi uv run aerich upgrade
```

`push_subscriptions` 테이블이 생성되어야 합니다.

3. 브라우저 상태 확인

- 사이트 알림 권한이 허용인지 확인
- Windows/브라우저 알림 설정이 꺼져 있지 않은지 확인
- 방해 금지 모드가 켜져 있지 않은지 확인
- 서비스 워커 변경 후에는 브라우저 새로고침 또는 강력 새로고침 필요

4. 클릭 동작 확인

알림 클릭 target은 `/app/chat?from=push&bundle_key=...` 형태입니다. 클릭 후 채팅 화면에서 해당 미응답 질문 카드가 보여야 합니다.

---

## 2026-04-22: 오른쪽 패널 저장 실패가 간헐적으로 뜰 때

### 증상

- 식사/수면/기분 등을 누르면 화면에는 반영되지만 저장 상태가 에러로 바뀜
- "저장 중 연결 문제가 있었어요. 잠시 후 다시 시도해주세요." 문구가 뜸

### 확인 순서

1. Network 탭에서 `PATCH /api/v1/health/daily/{YYYY-MM-DD}` 응답 확인
2. 422라면 요청 payload의 enum 값이 백엔드 모델과 맞는지 확인
3. 401이면 로그인 토큰 만료 또는 API base 설정 확인
4. 500이면 FastAPI 로그에서 `today_log_save_failed` 또는 Tortoise enum 오류 확인

현재 식사 legacy 값은 백엔드에서 방어합니다.

- `light` -> `hearty`
- `simple` -> `hearty`

그래도 실패하면 실제 응답 status와 payload를 같이 확인해야 합니다.

---

## 2026-04-22: YouTube 추천 영상이 엉뚱한 주제로 나올 때

### 원인

영상 추천은 YouTube 계정 추천 알고리즘이 아니라, 앱 내부 채팅 내역을 요약해 검색 키워드를 만든 뒤 YouTube 검색 결과를 보여주는 방식입니다. 채팅 내역이 부족하면 기본 건강/생활습관 fallback 키워드가 사용됩니다.

### 확인 순서

- `GET /api/v1/recommendations/videos` 응답의 `query` 확인
- 최근 대화가 반영되는지 확인
- 너무 앱 사용법 관련 질문만 있으면 건강/운동/수면 fallback이 나오는지 확인

---

## 2026-04-22: 리포트가 빈 화면처럼 보일 때

### 현재 동작

리포트는 최근 7일 기록을 우선 사용합니다. 기록이 부족해도 `summary.scorecard` fallback으로 건강 요약 카드와 현재 점수 영향 요인을 보여주도록 보강했습니다.

### 확인 순서

- `GET /api/v1/risk/current`
- `GET /api/v1/risk/history?weeks=7`
- `GET /api/v1/analysis/summary?period=7`

위 세 API 중 하나가 실패하면 리포트 일부가 비어 보일 수 있습니다.
