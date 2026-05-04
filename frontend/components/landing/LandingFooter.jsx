'use client';

import Link from 'next/link';

export default function LandingFooter() {
  return (
    <footer className="footer" role="contentinfo">
      <div className="container">
        <div className="footer__top">
          <div className="footer__brand-block">
            <div className="brand">
              <span className="brand__mark" aria-hidden="true">D</span>
              <span className="brand__name">DANAA</span>
            </div>
            <p>일하다 보니, 생활 패턴이 정리되더라. AI와 일상을 정리하는 과정에서 생활 맥락이 자연스럽게 따라옵니다.</p>
          </div>
          <div className="footer__cols">
            <div className="footer__col">
              <h3 className="footer__col-title">Product</h3>
              <ul>
                <li><a href="#features">핵심 기능</a></li>
                <li><a href="#deck">서비스 흐름</a></li>
                <li><a href="#compare">비교</a></li>
                <li><a href="#cta">시작하기</a></li>
              </ul>
            </div>
            <div className="footer__col">
              <h3 className="footer__col-title">Legal</h3>
              <ul>
                <li><Link href="/terms">이용약관</Link></li>
                <li><Link href="/privacy">개인정보 처리방침</Link></li>
                <li><a href="#trust">의료 면책 안내</a></li>
                <li><a href="mailto:hello@danaa.kr">문의</a></li>
              </ul>
            </div>
          </div>
        </div>
        <p className="footer__legal">
          © 2026 DANAA · 다나아는 <strong>의료 서비스가 아닙니다</strong>. 본 서비스가 제공하는 위험도와 코칭은 모두 참고용 지표이며, 의료 전문가의 진단·처방을 대체하지 않습니다. 의료 상담이 필요하면 의료기관(보건소·병원)에 방문하세요. 사주 기능은 자기이해와 재미를 위한 참고 리딩이며, 의료·심리 진단이 아닙니다. 언제든 당신의 데이터를 <strong>열람·정정·삭제·처리정지</strong>할 수 있으며, 「개인정보 보호법」 §35(이용자의 권리) 및 §39-2(정정·삭제 요청)를 준수합니다. 개인정보 침해 발생 시 §39-4에 따라 즉시 알립니다.
        </p>
      </div>
    </footer>
  );
}
