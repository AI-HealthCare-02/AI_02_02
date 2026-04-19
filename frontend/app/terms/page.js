export const metadata = {
  title: '서비스 이용약관 | 다나아(DA-NA-A)',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">서비스 이용약관</h1>
        <p className="text-sm text-gray-500 mb-8">최종 수정일: 2026년 4월 19일</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">제1조 (목적)</h2>
          <p className="text-gray-600 leading-relaxed">
            본 약관은 다나아(DA-NA-A) 서비스(이하 "서비스")의 이용 조건 및 절차,
            이용자와 서비스 제공자 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">제2조 (서비스 내용)</h2>
          <p className="text-gray-600 leading-relaxed">
            다나아는 만성질환(당뇨·고혈압) 예방을 위한 AI 건강 생활습관 코칭 서비스를 제공합니다.
          </p>
          <ul className="mt-2 list-disc list-inside text-gray-600 space-y-1">
            <li>AI 기반 당뇨 위험도 예측</li>
            <li>건강 추적 대시보드</li>
            <li>생활습관 챌린지</li>
            <li>AI 건강 코칭 채팅</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">제3조 (의료 정보 면책)</h2>
          <p className="text-gray-600 leading-relaxed">
            본 서비스가 제공하는 모든 건강 정보 및 위험도 예측 결과는 참고용이며,
            의학적 진단·치료·처방을 대체하지 않습니다.
            건강 관련 중요한 결정은 반드시 의료 전문가와 상담하시기 바랍니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">제4조 (회원 가입 및 계정)</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>이용자는 정확한 정보를 제공하여 회원 가입해야 합니다.</li>
            <li>계정 정보 관리 책임은 이용자에게 있습니다.</li>
            <li>타인의 정보를 도용하거나 허위 정보를 입력할 수 없습니다.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">제5조 (이용자 의무)</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>서비스를 불법적인 목적으로 이용할 수 없습니다.</li>
            <li>다른 이용자의 개인정보를 무단으로 수집·이용할 수 없습니다.</li>
            <li>서비스의 정상적인 운영을 방해하는 행위를 할 수 없습니다.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">제6조 (서비스 중단)</h2>
          <p className="text-gray-600 leading-relaxed">
            시스템 점검, 장애, 천재지변 등의 사유로 서비스 제공이 일시 중단될 수 있습니다.
            이로 인한 손해에 대해 서비스 제공자는 책임을 지지 않습니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">제7조 (약관 변경)</h2>
          <p className="text-gray-600 leading-relaxed">
            본 약관은 서비스 내 공지 또는 이메일 통보를 통해 변경될 수 있으며,
            변경된 약관은 공지 후 7일 이후부터 효력이 발생합니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">제8조 (문의)</h2>
          <p className="text-gray-600 leading-relaxed">
            서비스 이용 관련 문의사항은 아래 이메일로 연락해 주세요.
          </p>
          <p className="mt-2 text-gray-700 font-medium">이메일: qudwns4393@gmail.com</p>
        </section>

        <p className="text-sm text-gray-400 mt-12 border-t pt-6">
          본 약관은 2026년 4월 19일부터 적용됩니다.
        </p>
      </div>
    </div>
  );
}
