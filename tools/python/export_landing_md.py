"""다나아 V4 랜딩페이지 전체 코드를 단일 Markdown 파일로 추출.

수집 범위:
- frontend/app/{page.js, AuthRedirectGate.jsx, error.js, layout.js, globals.css, landing.css}
- frontend/components/landing/*
- frontend/hooks/landing/*

출력: C:/Users/mal03/Downloads/danaa-v4-landing-source.md
"""

from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FE = ROOT / 'frontend'
OUT = Path('C:/Users/mal03/Downloads/danaa-v4-landing-source.md')

# (제목, 상대경로, 코드펜스 언어)
FILES = [
    # 진입·인증·메타
    ('app/page.js (Server component — `/` 라우트 진입점, metadata export)', FE / 'app' / 'page.js', 'js'),
    ('app/AuthRedirectGate.jsx (Client — 인증 분기 게이트, ?preview=1 우회)', FE / 'app' / 'AuthRedirectGate.jsx', 'jsx'),
    ('app/error.js (Next.js Error Boundary)', FE / 'app' / 'error.js', 'js'),
    ('app/layout.js (Pretendard + Geist CDN preload 추가)', FE / 'app' / 'layout.js', 'js'),
    # 스타일
    ('app/globals.css (Tailwind + landing.css import)', FE / 'app' / 'globals.css', 'css'),
    ('app/landing.css (V4 전체 스타일, .danaa-landing 스코프)', FE / 'app' / 'landing.css', 'css'),
    # 컴포넌트 14개
    ('components/landing/LandingPage.jsx (8섹션 컴포지션 + 효과 hook 결합)', FE / 'components' / 'landing' / 'LandingPage.jsx', 'jsx'),
    ('components/landing/SymbolDefs.jsx (V4 inline SVG <symbol> 14개)', FE / 'components' / 'landing' / 'SymbolDefs.jsx', 'jsx'),
    ('components/landing/Icon.jsx (<use href> 래퍼)', FE / 'components' / 'landing' / 'Icon.jsx', 'jsx'),
    ('components/landing/LandingNav.jsx (Sticky nav + 자석 CTA)', FE / 'components' / 'landing' / 'LandingNav.jsx', 'jsx'),
    ('components/landing/HeroSection.jsx (Hero copy + mock window + floats + omni)', FE / 'components' / 'landing' / 'HeroSection.jsx', 'jsx'),
    ('components/landing/HeroOmni.jsx (효과 ② 옴니 원형 부활)', FE / 'components' / 'landing' / 'HeroOmni.jsx', 'jsx'),
    ('components/landing/PainSection.jsx (Pain 3카드)', FE / 'components' / 'landing' / 'PainSection.jsx', 'jsx'),
    ('components/landing/SolutionSection.jsx (Solution 3단계)', FE / 'components' / 'landing' / 'SolutionSection.jsx', 'jsx'),
    ('components/landing/BentoSection.jsx (효과 ① 벤토 박스 + spotlight)', FE / 'components' / 'landing' / 'BentoSection.jsx', 'jsx'),
    ('components/landing/ServiceFlowDeck.jsx (효과 ④ 3D 가로 deck)', FE / 'components' / 'landing' / 'ServiceFlowDeck.jsx', 'jsx'),
    ('components/landing/CompareTable.jsx (효과 ③ sticky 비교표)', FE / 'components' / 'landing' / 'CompareTable.jsx', 'jsx'),
    ('components/landing/TrustSection.jsx (Trust 3카드 + 통계 4)', FE / 'components' / 'landing' / 'TrustSection.jsx', 'jsx'),
    ('components/landing/CtaSection.jsx (CTA + 자석 버튼 + 패널)', FE / 'components' / 'landing' / 'CtaSection.jsx', 'jsx'),
    ('components/landing/LandingFooter.jsx (Footer)', FE / 'components' / 'landing' / 'LandingFooter.jsx', 'jsx'),
    # Hooks 7개
    ('hooks/landing/useReducedMotion.js (matchMedia, SSR-safe)', FE / 'hooks' / 'landing' / 'useReducedMotion.js', 'js'),
    ('hooks/landing/useScrollProgress.js (효과 — 스크롤 진행바)', FE / 'hooks' / 'landing' / 'useScrollProgress.js', 'js'),
    ('hooks/landing/useStickyNavObserver.js (Sticky nav shadow)', FE / 'hooks' / 'landing' / 'useStickyNavObserver.js', 'js'),
    ('hooks/landing/useRevealOnScroll.js (IntersectionObserver reveal)', FE / 'hooks' / 'landing' / 'useRevealOnScroll.js', 'js'),
    ('hooks/landing/useMouseTracking.js (글로벌 parallax + 로컬 spotlight)', FE / 'hooks' / 'landing' / 'useMouseTracking.js', 'js'),
    ('hooks/landing/useMagneticButton.js (자석 버튼)', FE / 'hooks' / 'landing' / 'useMagneticButton.js', 'js'),
    ('hooks/landing/useDeckNavigation.js (효과 ④ 3D deck 네비)', FE / 'hooks' / 'landing' / 'useDeckNavigation.js', 'js'),
]


def main() -> None:
    parts: list[str] = []
    parts.append('# 다나아 V4 랜딩페이지 — 전체 소스 코드\n')
    parts.append(f'> 생성: {datetime.now().strftime("%Y-%m-%d %H:%M")}  \n')
    parts.append('> 출처: `c:/Users/mal03/Desktop/레퍼런스/마지막 웹프로젝트/frontend/`\n\n')

    parts.append('## 개요\n\n')
    parts.append('Next.js 14 (App Router, JavaScript/JSX) + Tailwind v4 기반.\n')
    parts.append('V4 mockup HTML 단일 파일을 `app/page.js` 진입점 + 14개 컴포넌트 + 7개 커스텀 훅으로 분해 통합.\n\n')

    parts.append('### 사용자 명시 4가지 핵심 효과\n\n')
    parts.append('| # | 효과 | 핵심 기술 | 매핑 컴포넌트 |\n')
    parts.append('|---|---|---|---|\n')
    parts.append('| 1 | 벤토 박스 레이아웃 | CSS Grid 12-col + Flexbox + Hover transform | `BentoSection.jsx` |\n')
    parts.append('| 2 | 옴니 원형 애니메이션 | SVG 점선 원 + CSS Keyframes + Radial Gradient + backdrop-filter | `HeroOmni.jsx` |\n')
    parts.append('| 3 | 인터랙티브 데이터 테이블 | position:sticky thead/first column + Pill + React 가상 DOM | `CompareTable.jsx` |\n')
    parts.append('| 4 | 3D 입체 스크롤 네비 | CSS 3D Transforms + IntersectionObserver + 키보드/터치 | `ServiceFlowDeck.jsx` + `useDeckNavigation.js` |\n\n')

    parts.append('### 디렉토리 구조\n\n')
    parts.append('```\n')
    parts.append('frontend/\n')
    parts.append('├── app/\n')
    parts.append('│   ├── page.js               ← 진입점 (server, metadata export)\n')
    parts.append('│   ├── AuthRedirectGate.jsx  ← 인증 분기 (?preview=1 우회 가능)\n')
    parts.append('│   ├── error.js              ← Error Boundary\n')
    parts.append('│   ├── layout.js             ← 폰트 preload (Pretendard + Geist)\n')
    parts.append('│   ├── globals.css           ← @import "./landing.css"\n')
    parts.append('│   └── landing.css           ← V4 스타일 ~1900줄 (.danaa-landing 스코프)\n')
    parts.append('├── components/landing/       ← 14개 컴포넌트\n')
    parts.append('│   ├── LandingPage.jsx       ← 컴포지션 + 4효과 hook 결합\n')
    parts.append('│   ├── SymbolDefs.jsx + Icon.jsx\n')
    parts.append('│   ├── LandingNav.jsx + LandingFooter.jsx\n')
    parts.append('│   ├── HeroSection.jsx + HeroOmni.jsx\n')
    parts.append('│   ├── PainSection.jsx + SolutionSection.jsx\n')
    parts.append('│   ├── BentoSection.jsx          ← 효과 ①\n')
    parts.append('│   ├── ServiceFlowDeck.jsx       ← 효과 ④\n')
    parts.append('│   ├── CompareTable.jsx          ← 효과 ③\n')
    parts.append('│   ├── TrustSection.jsx + CtaSection.jsx\n')
    parts.append('└── hooks/landing/            ← 7개 훅\n')
    parts.append('    ├── useReducedMotion.js\n')
    parts.append('    ├── useScrollProgress.js + useStickyNavObserver.js + useRevealOnScroll.js\n')
    parts.append('    ├── useMouseTracking.js + useMagneticButton.js\n')
    parts.append('    └── useDeckNavigation.js      ← 효과 ④\n')
    parts.append('```\n\n')

    parts.append('---\n\n')

    # 각 파일 코드 추가
    missing = []
    total_lines = 0
    for title, path, lang in FILES:
        if not path.exists():
            missing.append(str(path))
            continue
        text = path.read_text(encoding='utf-8')
        line_count = text.count('\n') + 1
        total_lines += line_count
        # 파일 안에 ``` 가 있을 가능성 거의 없지만 안전하게 4 backtick 사용
        fence = '````' if '```' in text else '```'
        parts.append(f'## `{title}`\n\n')
        parts.append(f'_경로_: `frontend/{path.relative_to(FE).as_posix()}` · _{line_count}줄_\n\n')
        parts.append(f'{fence}{lang}\n')
        parts.append(text)
        if not text.endswith('\n'):
            parts.append('\n')
        parts.append(f'{fence}\n\n')

    parts.append('---\n\n')
    parts.append(f'**총 {len(FILES) - len(missing)}개 파일, {total_lines:,}줄.**\n')
    if missing:
        parts.append('\n**누락 파일** (위치 변경 또는 미생성):\n')
        for m in missing:
            parts.append(f'- {m}\n')

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(''.join(parts), encoding='utf-8')
    size_kb = OUT.stat().st_size / 1024
    print(f'OK: wrote {OUT} ({size_kb:.1f} KB, {total_lines:,} lines of code)')


if __name__ == '__main__':
    main()
