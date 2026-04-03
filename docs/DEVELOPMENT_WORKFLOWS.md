# 개발 작업 방법 가이드

> Git 사용법, 커밋 규칙, PR 만드는 방법을 알려주는 문서
> Git이 처음이라면 이 문서부터 읽으세요!

---

## 1. Git이 뭔가요? (30초 설명)

비유: **"게임 세이브 포인트"**

- `commit` = 세이브 (현재 상태 저장)
- `branch` = 다른 세이브 슬롯 (원본 안 건드리고 실험)
- `push` = 클라우드 동기화 (내 세이브를 팀 저장소에 올리기)
- `pull` = 팀 세이브 받기 (팀원이 올린 걸 내 컴퓨터로)
- `PR(Pull Request)` = "이 세이브 합쳐도 될까요?" 요청

---

## 2. 브랜치 규칙 (작업 전 반드시!)

### 브랜치 이름 짓기

```
feature/기능이름    <-- 새 기능 만들 때
fix/버그이름        <-- 버그 고칠 때
docs/문서이름       <-- 문서 수정할 때
refactor/대상      <-- 코드 정리할 때
```

### 예시

```bash
# 새 브랜치 만들기 + 이동
git checkout -b feature/dashboard-api

# 브랜치 확인
git branch    # * 표시가 현재 위치
```

### 절대 하면 안 되는 것

- **`main` 브랜치에서 직접 코드 수정 금지!**
- 항상 새 브랜치를 만들어서 작업하세요.

---

## 3. 커밋 메시지 규칙

### 형식

```
<이모지> <타입>: <한 줄 설명>
```

### 타입 목록 (외울 필요 없어요, 여기 보고 쓰면 돼요)

| 이모지 | 타입 | 언제 쓰나요? | 예시 |
|--------|------|-------------|------|
| ✨ | feat | 새 기능을 만들었을 때 | ✨ feat: 대시보드 초기 로딩 API 구현 |
| 🐛 | fix | 버그를 고쳤을 때 | 🐛 fix: 로그인 시 토큰 만료 시간 오류 수정 |
| 📝 | docs | 문서를 수정했을 때 | 📝 docs: QUICK_START.md 작성 |
| 💡 | chore | 기능 변경 없이 잡일할 때 | 💡 chore: 불필요한 주석 정리 |
| ✅ | test | 테스트를 추가했을 때 | ✅ test: 챌린지 체크인 단위 테스트 추가 |
| ♻️ | refactor | 코드 구조만 바꿨을 때 | ♻️ refactor: 대시보드 서비스 함수 분리 |
| 🚚 | build | 빌드/설정 파일을 바꿨을 때 | 🚚 build: Docker compose Redis 포트 변경 |
| 🎨 | style | 코드 포매팅만 바꿨을 때 | 🎨 style: ruff format 적용 |
| 🚑 | hotfix | 긴급 수정할 때 | 🚑 hotfix: 프로덕션 DB 연결 오류 수정 |

---

## 4. 커밋하기 (실전)

```bash
# 1. 변경 파일 확인
git status

# 2. 커밋할 파일 선택 (파일 이름을 직접 지정!)
git add app/services/dashboard.py
git add app/apis/v1/dashboard_routers.py

# 3. 커밋 (메시지 형식 지키기)
git commit -m "✨ feat: 대시보드 통합 조회 API 구현"

# 4. 원격 저장소에 올리기
git push origin feature/dashboard-api
```

> 주의: `git add .` 은 가능하면 피하세요. 의도하지 않은 파일(.env 등)이 포함될 수 있어요.

---

## 5. "커밋이 거부됐어요!" -- Git Hook 에러 해결

이 프로젝트에는 커밋할 때 **자동으로 돌아가는 검사가 2개** 있어요.

### 검사 1: ruff 코드 검사 (pre-commit)

```
========================================
  커밋 차단: ruff 린트 에러가 있습니다
========================================
```

**해결:**

```bash
# 자동 수정 시도
uv run ruff check . --fix

# 수정된 파일 다시 스테이징 + 커밋
git add .
git commit -m "✨ feat: 기능 설명"
```

### 검사 2: 커밋 메시지 형식 (commit-msg)

```
========================================
  커밋 메시지 형식이 올바르지 않습니다
========================================
```

**해결:** 3번 섹션의 형식에 맞게 메시지를 다시 쓰세요.

- 틀린 예: `"대시보드 수정함"` (이모지, 타입 없음)
- 맞는 예: `"✨ feat: 대시보드 수정"`

---

## 6. Git Hook 처음 설정 (클론 후 한 번만)

```bash
bash scripts/setup-hooks.sh
```

이 명령어가 `scripts/hooks/` 안의 검사 스크립트를 Git에 연결해줍니다.

---

## 7. PR(Pull Request) 만들기

### GitHub에서 PR 만드는 순서

1. push 완료 후 GitHub 저장소 페이지 방문
2. "Compare & pull request" 버튼 클릭
3. 제목: 커밋 메시지와 비슷하게 (이모지 + 타입 + 설명)
4. 설명: 뭘 왜 바꿨는지 간단히

### PR 체크리스트

- [ ] main이 아닌 feature/ 브랜치에서 작업했나요?
- [ ] `uv run ruff check .` 에러 없나요?
- [ ] 커밋 메시지 형식을 지켰나요?
- [ ] 관련 없는 파일(.env 등)이 포함되지 않았나요?

---

## 8. 코드 품질 도구

```bash
# 코드 스타일 검사 (Python)
uv run ruff check .

# 자동 수정
uv run ruff check . --fix

# 코드 포매팅
uv run ruff format .

# 테스트 실행
uv run coverage run -m pytest app

# 테스트 커버리지 보기
uv run coverage report -m
```

---

## 9. CI/CD (자동 검사)

GitHub에 push하면 자동으로 2가지 검사가 실행됩니다:

1. **Lint**: ruff check + ruff format 확인
2. **Test**: PostgreSQL DB와 함께 pytest 54개 테스트 실행

이 검사가 실패하면 PR을 머지할 수 없어요.

트리거 브랜치: `main`, `develop`, `release/*`, `hotfix/*`

---

## 10. Claude Code와 함께 작업할 때

### 세션 시작

1. `"progress.md 읽어줘"` -- 현재 진행 상태 파악
2. `/next-task` -- 다음 할 일 추천

### 기능 구현

1. `/plan` -- 계획 세우기
2. 계획 확인 후 `"실행해줘"` -- 실제 구현
3. 자동 검증 후 결과 확인
4. `/commit-push-pr` -- 커밋 + PR
