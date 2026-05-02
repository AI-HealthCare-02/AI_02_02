'use client';

/**
 * <use href="#i-..."> 래퍼. 사용처에서 width/height만 지정.
 * 의존: <SymbolDefs /> 가 같은 페이지에 1회 마운트되어 있어야 함.
 */
export default function Icon({ id, size = 16, className = '', ...rest }) {
  return (
    <svg width={size} height={size} className={className} aria-hidden="true" {...rest}>
      <use href={`#i-${id}`} />
    </svg>
  );
}
