"""V4 mockup CSS → landing.css scoped to .danaa-landing.

원본: docs/landing-mockup/danaa-landing-v4.html <style> 블록
출력: frontend/app/landing.css

CSS state machine:
- depth=0: 최상위 (또는 @media/@supports 안에서 ruleset 밖) — selector 누적
- depth>=1: ruleset 안 (선언 영역) — `,` 줄바꿈은 selector가 아니라 property value 연속
- @keyframes ... { ... }: 내부의 from/to/N% 는 selector 변환 안 함
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'docs' / 'landing-mockup' / 'danaa-landing-v4.html'
DST = ROOT / 'frontend' / 'app' / 'landing.css'

PREFIX = '.danaa-landing'


def transform_selector(sel: str) -> str:
    sel = sel.strip()
    if not sel:
        return sel
    if sel == ':root':
        return f':where({PREFIX})'
    if sel in ('body', 'html', 'html, body', 'body, html'):
        return PREFIX
    if sel == 'body::before':
        return f'{PREFIX}::before'
    if sel == 'body::after':
        return f'{PREFIX}::after'
    # 이미 prefix가 있으면 skip
    if sel.startswith(f'{PREFIX} ') or sel.startswith(f'{PREFIX}.') or sel.startswith(f'{PREFIX}::') or sel.startswith(f'{PREFIX}:') or sel == PREFIX:
        return sel
    return f'{PREFIX} {sel}'


def emit_selector_block(sel_buffer: list[str], indent: str) -> str:
    """sel_buffer: lines of selector text (without trailing { or ,). Returns transformed selector list."""
    full = ' '.join(s.strip() for s in sel_buffer if s.strip())
    if not full:
        return ''
    selectors = [s.strip() for s in full.split(',') if s.strip()]
    transformed = [transform_selector(s) for s in selectors]
    return indent + (',\n' + indent).join(transformed)


def main() -> None:  # noqa: C901  # CSS 상태 머신 — 한 함수에 모아두는 게 가독성 좋음
    html = SRC.read_text(encoding='utf-8')
    m = re.search(r'<style>\n(.*?)\n  </style>', html, re.DOTALL)
    if not m:
        m = re.search(r'<style>(.*?)</style>', html, re.DOTALL)
    css = m.group(1)

    out_lines: list[str] = []
    sel_buffer: list[str] = []  # 누적 중인 selector lines
    depth = 0  # ruleset 깊이 (선언 영역 안인지)
    keyframes_depth = 0  # @keyframes 안에 들어간 brace 카운트 (양수면 그 안)
    in_at_block_depth = 0  # @media/@supports 같은 nested at-rule 안 (selector 처리 필요)
    in_block_comment = False  # 멀티라인 /* ... */ 주석 안인지

    lines = css.split('\n')

    for raw in lines:
        line = raw.rstrip('\n')
        stripped = line.strip()
        leading = line[:len(line) - len(line.lstrip())]

        # 멀티라인 블록 주석 처리 — 가장 우선
        if in_block_comment:
            out_lines.append(line)
            if '*/' in line:
                in_block_comment = False
            continue
        # 라인에서 /* 시작 감지 (이미 단일 라인 끝나는 경우는 다음 분기)
        if '/*' in line and '*/' not in line.split('/*', 1)[1]:
            # 이 라인은 주석 시작 — 다음 라인부터 in_block_comment
            out_lines.append(line)
            in_block_comment = True
            continue

        # 빈 줄 / 단독 주석 등은 즉시 출력 처리 (selector 누적 흐름과 분리)
        if stripped == '':
            if sel_buffer:
                continue
            out_lines.append(line)
            continue
        # 단독 라인 주석 (/* ... */ 또는 /* ...로 시작) — 위에서 멀티라인 케이스는 처리됨
        if stripped.startswith('/*') or stripped.startswith('*'):
            # selector 누적 중이라면 누적 일단 emit 하지 않고, 주석을 출력 후 누적 유지
            # 단, depth==0이고 sel_buffer가 비어있을 때만 안전하게 출력 가능
            if not sel_buffer:
                out_lines.append(line)
                continue
            # selector 누적 중에 주석이 끼어들면 — selector 끝나기 전 separator로 사용 X.
            # 보존을 위해 주석을 별도 라인으로 그냥 출력 (selector list에 영향 없음)
            out_lines.append(line)
            continue

        # @keyframes 처리: 내부 selector를 prefix하지 않음
        if stripped.startswith('@keyframes') or stripped.startswith('@-webkit-keyframes'):
            keyframes_depth = 1 if '{' in stripped else 0
            out_lines.append(line)
            continue

        if keyframes_depth > 0:
            keyframes_depth += line.count('{') - line.count('}')
            out_lines.append(line)
            continue

        # @media / @supports / @container / @layer 진입: 그대로 출력하고 selector는 안에서 변환됨
        if re.match(r'^\s*@(media|supports|container|layer)\b', line):
            out_lines.append(line)
            in_at_block_depth += 1 if '{' in stripped else 0
            continue

        # 그 외 단순 @-rule (@import, @font-face, @page 등): 그대로
        if stripped.startswith('@') and depth == 0:
            out_lines.append(line)
            continue

        # 선언 블록 내부 (depth >= 1)
        if depth >= 1:
            # 닫는 brace 처리
            close_count = stripped.count('}')
            open_count = stripped.count('{')
            net = open_count - close_count
            depth += net
            if depth < 0:
                # @media 종료
                in_at_block_depth = max(0, in_at_block_depth - 1)
                depth = 0
            out_lines.append(line)
            continue

        # depth == 0: selector 영역
        # selector 누적
        # `{` 가 있으면 ruleset 시작 → emit
        if '{' in stripped:
            # selector 부분 + { 분리
            brace_idx = stripped.index('{')
            sel_part = stripped[:brace_idx].rstrip()
            rest = stripped[brace_idx:]
            if sel_part:
                sel_buffer.append(sel_part)
            transformed = emit_selector_block(sel_buffer, leading)
            out_lines.append(transformed + ' ' + rest)
            sel_buffer = []
            depth += 1
            # 만약 같은 줄에 `}`도 있으면 즉시 ruleset 종료
            depth -= rest.count('}') - rest.count('{')[1:].count('{') if False else stripped.count('}')
            # 위 한 줄 hack 불필요. 단순히:
            depth = max(0, depth)
            # 더 단순한 방법: 위에 추가한 net을 다시 계산
            # depth 갱신 정확히:
            depth = depth - 1 + (rest.count('{') - rest.count('}'))
            if depth < 0:
                depth = 0
            continue
        elif '}' in stripped:
            # 직전 selector 누적 무효 + 그냥 닫기 (이상 케이스)
            sel_buffer = []
            out_lines.append(line)
            in_at_block_depth = max(0, in_at_block_depth - 1)
            continue
        else:
            # selector 계속 누적 (콤마로 끝나든 말든)
            sel_buffer.append(line)
            continue

    # 후처리: ruleset 안의 multi-line property value를 한 줄로 join
    # (Tailwind v4 lightningcss strict parser 호환을 위해)
    joined = []
    depth = 0
    in_kf = False
    kf_depth = 0
    pending = ''
    for line in out_lines:
        stripped = line.strip()
        # @keyframes 진입/종료 추적
        if stripped.startswith('@keyframes') or stripped.startswith('@-webkit-keyframes'):
            if pending:
                joined.append(pending)
                pending = ''
            in_kf = True
            kf_depth = 1 if '{' in stripped else 0
            joined.append(line)
            continue
        if in_kf:
            kf_depth += line.count('{') - line.count('}')
            joined.append(line)
            if kf_depth <= 0:
                in_kf = False
            continue
        # depth 추적: ruleset 안일 때 trailing `,` 인 line 은 다음 line과 join
        prev_depth = depth
        depth += line.count('{') - line.count('}')
        if depth < 0:
            depth = 0
        if prev_depth >= 1 and stripped.endswith(',') and '{' not in stripped and '}' not in stripped:
            pending = (pending + ' ' if pending else '') + stripped
            continue
        if pending:
            joined.append(pending + ' ' + line.lstrip())
            pending = ''
        else:
            joined.append(line)

    header = (
        '/* ═════════════════════════════════════════════════════════════\n'
        '   DANAA V4 LANDING — Production Stylesheet\n'
        '   원본: docs/landing-mockup/danaa-landing-v4.html\n'
        '   범위: .danaa-landing 페이지 스코프 — 다른 라우트 영향 0\n'
        '   생성: tools/python/convert_v4_css.py 자동 변환\n'
        '   ═════════════════════════════════════════════════════════════ */\n\n'
    )
    DST.write_text(header + '\n'.join(joined).strip() + '\n', encoding='utf-8')
    print(f'OK: wrote {DST} ({len(joined)} lines)')


if __name__ == '__main__':
    main()
