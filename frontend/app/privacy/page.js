export const metadata = {
  title: '개인정보처리방침 | 다나아(DA-NA-A)',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">개인정보처리방침</h1>
        <p className="text-sm text-gray-500 mb-8">최종 수정일: 2026년 4월 19일</p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">1. 수집하는 개인정보 항목</h2>
          <p className="text-gray-600 leading-relaxed">
            다나아(DA-NA-A)는 서비스 제공을 위해 다음과 같은 개인정보를 수집합니다.
          </p>
          <ul className="mt-2 list-disc list-inside text-gray-600 space-y-1">
            <li>이메일 주소, 이름, 생년월일</li>
            <li>소셜 로그인 시 제공되는 프로필 정보 (카카오, 네이버, 구글)</li>
            <li>건강 설문 정보 (BMI, 혈압, 생활습관 등 비침습적 정보)</li>
            <li>서비스 이용 기록, 접속 로그</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">2. 개인정보 수집 및 이용 목적</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>회원 가입 및 본인 확인</li>
            <li>AI 기반 건강 위험도 예측 및 생활습관 코칭 서비스 제공</li>
            <li>건강 기록 관리 및 대시보드 제공</li>
            <li>서비스 개선 및 통계 분석</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">3. 개인정보 보유 및 이용 기간</h2>
          <p className="text-gray-600 leading-relaxed">
            회원 탈퇴 시까지 보유하며, 탈퇴 후 즉시 파기합니다.
            단, 관련 법령에 따라 일정 기간 보존이 필요한 경우 해당 기간 동안 보관합니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">4. 개인정보의 제3자 제공</h2>
          <p className="text-gray-600 leading-relaxed">
            다나아는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다.
            다만, 이용자가 사전에 동의한 경우 또는 법령에 의한 경우는 예외로 합니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">5. 개인정보 처리 위탁</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>Amazon Web Services (AWS) - 서버 인프라 운영</li>
            <li>OpenAI - AI 채팅 서비스 제공</li>
            <li>Vercel - 프론트엔드 서비스 운영</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">6. 이용자의 권리</h2>
          <p className="text-gray-600 leading-relaxed">
            이용자는 언제든지 자신의 개인정보를 조회, 수정, 삭제할 수 있으며
            개인정보 처리에 대한 동의를 철회할 수 있습니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">7. 개인정보 보호책임자</h2>
          <p className="text-gray-600 leading-relaxed">
            개인정보 관련 문의사항은 아래 이메일로 연락해 주세요.
          </p>
          <p className="mt-2 text-gray-700 font-medium">이메일: qudwns4393@gmail.com</p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">8. 의료 정보 관련 고지</h2>
          <p className="text-gray-600 leading-relaxed">
            다나아가 제공하는 건강 위험도 예측 및 코칭 정보는 의학적 진단이나 치료를 대체하지 않습니다.
            건강 관련 중요한 결정은 반드시 의료 전문가와 상담하시기 바랍니다.
          </p>
        </section>

        <p className="text-sm text-gray-400 mt-12 border-t pt-6">
          본 방침은 2026년 4월 19일부터 적용됩니다.
        </p>
      </div>
    </div>
  );
}
