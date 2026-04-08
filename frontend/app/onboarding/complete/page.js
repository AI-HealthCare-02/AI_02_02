'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

/* ── FINDRISC 계산 (백엔드 prediction.py 포팅) ── */
function calculateFindrisc(data) {
  if (!data) return null;

  const AGE_LABELS = ['10대','20대','30대','40대','50대','60대+'];
  const ageLabel = data.age !== null ? AGE_LABELS[data.age] : null;

  // age score: 10~30대→0, 40대→2, 50대→3, 60대+→4
  let ageScore = 0;
  if (data.age >= 3) ageScore = 2;
  if (data.age >= 4) ageScore = 3;
  if (data.age >= 5) ageScore = 4;

  // bmi
  const bmi = data.weight / ((data.height / 100) ** 2);
  let bmiScore = 0;
  if (bmi >= 25 && bmi < 30) bmiScore = 1;
  if (bmi >= 30) bmiScore = 3;

  // waist: 온보딩에서 안 받으므로 0
  const waistScore = 0;

  // activity: 3~4회(2) or 5회+(3)→0, 나머지→2
  const activityScore = (data.exercise >= 2) ? 0 : 2;

  // vegetable: diet 배열에 채소과일(3) 포함→0, 아니면→1
  const vegScore = (data.diet && data.diet.includes(3)) ? 0 : 1;

  // hypertension: conditions에 고혈압(0) 포함→2, 아니면→0
  const htScore = (data.conditions && data.conditions.includes(0)) ? 2 : 0;

  // glucose_history: conditions에 고혈당이력(2) 포함→5, 아니면→0
  const glucoseScore = (data.conditions && data.conditions.includes(2)) ? 5 : 0;

  // family: 가족(0)→5, 친척(1)→3, 없음/모름→0
  let familyScore = 0;
  if (data.family === 0) familyScore = 5;
  if (data.family === 1) familyScore = 3;

  const total = ageScore + bmiScore + waistScore + activityScore + vegScore + htScore + glucoseScore + familyScore;

  // 위험도 분류
  let level, levelLabel, levelColor;
  if (total <= 3) { level = 'LOW'; levelLabel = '낮음'; levelColor = '#4CAF50'; }
  else if (total <= 8) { level = 'SLIGHT'; levelLabel = '약간'; levelColor = '#8BC34A'; }
  else if (total <= 12) { level = 'MODERATE'; levelLabel = '보통'; levelColor = '#FFC107'; }
  else if (total <= 20) { level = 'HIGH'; levelLabel = '높음'; levelColor = '#FF7043'; }
  else { level = 'VERY_HIGH'; levelLabel = '매우 높음'; levelColor = '#E53935'; }

  // 그룹 분류
  const RELATION_GROUPS = ['A', 'B', 'C', 'D'];
  const RELATION_LABELS = ['당뇨 진단', '전당뇨(경계)', '가족력', '건강관리'];
  const group = RELATION_GROUPS[data.relation] || 'D';
  const groupLabel = RELATION_LABELS[data.relation] || '건강관리';

  // 운동 레이블
  const EXERCISE_LABELS = ['거의 안 함', '주 1~2회', '주 3~4회', '주 5회+'];
  const exerciseLabel = EXERCISE_LABELS[data.exercise] || '미입력';

  // BMI 분류
  let bmiCategory = '정상';
  if (bmi < 18.5) bmiCategory = '저체중';
  else if (bmi >= 25 && bmi < 30) bmiCategory = '과체중';
  else if (bmi >= 30) bmiCategory = '비만';

  return {
    score: total, level, levelLabel, levelColor,
    group, groupLabel, ageLabel,
    bmi: bmi.toFixed(1), bmiCategory,
    exerciseLabel,
    breakdown: { age: ageScore, bmi: bmiScore, waist: waistScore, activity: activityScore, vegetable: vegScore, hypertension: htScore, glucose_history: glucoseScore, family: familyScore },
  };
}

export default function OnboardingComplete() {
  const [risk, setRisk] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('danaa_onboarding');
      if (saved) {
        const data = JSON.parse(saved);
        const result = calculateFindrisc(data);
        setRisk(result);
        // 리포트에서 쓸 수 있도록 위험도 결과 저장
        if (result) localStorage.setItem('danaa_risk', JSON.stringify(result));
      }
    } catch {}
    setLoaded(true);
  }, []);

  if (!loaded) return null;

  // 온보딩 데이터 없으면 기본값
  const profile = risk || {
    group: 'B', groupLabel: '전당뇨', ageLabel: '30대',
    bmi: '24.2', bmiCategory: '정상', exerciseLabel: '주 1~2회',
    levelLabel: '주의', levelColor: '#E65100', score: 12, level: 'MODERATE',
  };

  const levelBgColors = {
    LOW: '#E8F5E9', SLIGHT: '#F0FFF0', MODERATE: '#FFF3E0', HIGH: '#FBE9E7', VERY_HIGH: '#FFEBEE',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-400 via-cream to-neutral-100 flex items-center justify-center p-6">
      <div className="w-[380px] h-[600px] bg-white rounded-xl shadow-modal flex flex-col justify-center p-8 text-center">

        <div className="text-[48px] mb-4">🎉</div>
        <h2 className="text-[22px] font-bold text-nature-900 mb-2">설문 완료!</h2>
        <p className="text-[13px] text-neutral-400 mb-6">당신만의 건강 프로필이 생성되었습니다</p>

        {/* 요약 카드 */}
        <div className="bg-cream-300 rounded-xl border border-cream-500 p-5 text-left mb-4">
          <h4 className="text-[13px] font-semibold text-nature-900 mb-3">📋 내 건강 프로필</h4>
          {[
            ['그룹', `${profile.group}그룹 (${profile.groupLabel})`],
            ['연령대', profile.ageLabel || '—'],
            ['BMI', `${profile.bmi} (${profile.bmiCategory})`],
            ['운동', profile.exerciseLabel],
            ['위험도', profile.levelLabel],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-1.5 border-b border-[#f5f5f5] last:border-0">
              <span className="text-[12px] text-neutral-400">{label}</span>
              <span className="text-[12px] font-medium text-nature-900">{value}</span>
            </div>
          ))}
        </div>

        {/* 위험도 */}
        <div className="rounded-xl px-5 py-3.5 mb-6" style={{ backgroundColor: levelBgColors[profile.level] || '#FFF3E0' }}>
          <span className="text-[13px] font-semibold" style={{ color: profile.levelColor }}>
            ⚠️ 당뇨 위험도: {profile.levelLabel} ({profile.score}점/26점)
          </span>
        </div>

        {/* CTA */}
        <Link href="/app/chat" className="inline-block w-full py-3.5 bg-nature-900 text-white text-[14px] font-semibold rounded-xl hover:bg-nature-800 hover:-translate-y-px shadow-soft transition-all">
          메인으로 이동 →
        </Link>
      </div>
    </div>
  );
}
