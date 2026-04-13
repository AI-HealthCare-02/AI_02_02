'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { api, setToken } from '../../../hooks/useApi';

const REQUEST_TIMEOUT_MS = 15000;

const RELATION_MAP = ['diagnosed', 'prediabetes', 'family', 'curious'];
const GENDER_MAP = ['MALE', 'FEMALE'];
const AGE_RANGE_MAP = ['under_45', 'under_45', 'under_45', '45_54', '55_64', '65_plus'];
const FAMILY_MAP = ['parents', 'siblings', 'none', 'unknown'];
const CONDITION_MAP = ['hypertension', 'dyslipidemia', 'high_glucose', 'gestational', 'none'];
const TREATMENT_MAP = ['lifestyle', 'oral_med', 'insulin', 'other_med', 'nothing'];
const HBA1C_MAP = ['under_5_7', '5_7_to_6_4', '6_5_to_7_0', 'over_7', 'unknown'];
const FASTING_GLUCOSE_MAP = ['under_100', '100_to_125', 'over_126', 'unknown'];
const EXERCISE_MAP = ['none', '1_2_per_week', '3_4_per_week', '5_plus_per_week'];
const DIET_MAP = ['carb_heavy', 'sugary_drink', 'late_snack', 'veggies_daily', 'irregular_meals', 'none'];
const SLEEP_MAP = ['under_5', 'between_5_6', 'between_7_8', 'over_8'];
const ALCOHOL_MAP = ['none', 'sometimes', 'often', 'daily'];
const SMOKING_MAP = ['non_smoker', 'former', 'current'];
const GOAL_MAP = ['risk_assessment', 'health_tracking', 'diet_improvement', 'exercise_habit', 'weight_management', 'all'];

function mapArray(indices, mapper) {
  if (!Array.isArray(indices)) return [];
  return indices
    .map((index) => mapper[index])
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

function buildSurveyPayload(saved) {
  const lab = saved.lab || {};

  return {
    relation: RELATION_MAP[saved.relation] || 'curious',
    gender: GENDER_MAP[saved.gender] || 'FEMALE',
    age_range: AGE_RANGE_MAP[saved.age] || 'under_45',
    height_cm: Number(saved.height) || 170,
    weight_kg: Number(saved.weight) || 70,
    family_history: FAMILY_MAP[saved.family] || 'unknown',
    conditions: mapArray(saved.conditions, CONDITION_MAP),
    treatments: mapArray(saved.treatment, TREATMENT_MAP),
    hba1c_range: HBA1C_MAP[lab[0]] || null,
    fasting_glucose_range: FASTING_GLUCOSE_MAP[lab[1]] || null,
    exercise_frequency: EXERCISE_MAP[saved.exercise] || 'none',
    diet_habits: mapArray(saved.diet, DIET_MAP),
    sleep_duration_bucket: SLEEP_MAP[saved.lifestyle_sleep] || 'between_7_8',
    alcohol_frequency: ALCOHOL_MAP[saved.lifestyle_alcohol] || 'sometimes',
    smoking_status: SMOKING_MAP[saved.lifestyle_smoking] || 'non_smoker',
    goals: mapArray(saved.goals, GOAL_MAP),
    ai_consent: 'agreed',
  };
}

function calculateSummary(saved) {
  const height = Number(saved.height) || 170;
  const weight = Number(saved.weight) || 70;
  const bmi = weight / ((height / 100) ** 2);

  return {
    relation: RELATION_MAP[saved.relation] || 'curious',
    bmi: bmi.toFixed(1),
    exercise: EXERCISE_MAP[saved.exercise] || 'none',
  };
}

async function apiWithTimeout(path, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await api(path, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('요청이 너무 오래 걸립니다. 백엔드 컨테이너와 네트워크 상태를 확인해주세요.');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export default function OnboardingComplete() {
  const [savedData, setSavedData] = useState(null);
  const [submitState, setSubmitState] = useState('idle');
  const [error, setError] = useState('');
  const [progressLabel, setProgressLabel] = useState('준비 중입니다.');

  useEffect(() => {
    try {
      const raw = localStorage.getItem('danaa_onboarding');
      if (raw) {
        setSavedData(JSON.parse(raw));
      } else {
        setSavedData({});
      }
    } catch {
      setSavedData({});
    }
  }, []);

  useEffect(() => {
    if (submitState !== 'submitting') return undefined;

    let cancelled = false;
    const intervalId = window.setInterval(async () => {
      try {
        const statusRes = await api('/api/v1/onboarding/status');
        if (!statusRes.ok) return;
        const status = await statusRes.json();
        if (!status.is_completed || cancelled) return;

        setProgressLabel('저장이 완료되었습니다. 아래 버튼을 눌러 메인으로 이동해주세요.');
        setSubmitState('done');
        window.clearInterval(intervalId);
      } catch {}
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [submitState]);

  useEffect(() => {
    if (!savedData || submitState !== 'idle') return;

    let cancelled = false;

    async function submitOnboarding() {
      setSubmitState('submitting');
      setError('');

      try {
        setProgressLabel('약관 동의 정보를 저장하고 있습니다.');
        const consentRes = await apiWithTimeout('/api/v1/auth/consent', {
          method: 'POST',
          body: JSON.stringify({
            terms_of_service: true,
            privacy_policy: true,
            health_data_consent: true,
            disclaimer_consent: true,
            marketing_consent: false,
          }),
        });
        if (!consentRes.ok) {
          const data = await consentRes.json().catch(() => ({}));
          throw new Error(data.detail || '온보딩 동의 저장에 실패했습니다.');
        }

        setProgressLabel('설문 결과를 저장하고 있습니다.');
        const surveyRes = await apiWithTimeout('/api/v1/onboarding/survey', {
          method: 'POST',
          body: JSON.stringify(buildSurveyPayload(savedData)),
        });
        const surveyData = await surveyRes.json().catch(() => ({}));

        if (!surveyRes.ok && surveyRes.status !== 409) {
          throw new Error(surveyData.detail || '온보딩 저장에 실패했습니다.');
        }

        if (surveyData.access_token) {
          setToken(surveyData.access_token);
        }

        try {
          localStorage.setItem('danaa_onboarding', JSON.stringify(savedData));
          localStorage.setItem('danaa_tutorial_pending', 'true');
          if (surveyData.user_group || surveyData.initial_findrisc_score || surveyData.initial_risk_level) {
            localStorage.setItem(
              'danaa_risk',
              JSON.stringify({
                group: surveyData.user_group || null,
                score: surveyData.initial_findrisc_score || null,
                level: surveyData.initial_risk_level || null,
              }),
            );
          }
        } catch {}

        if (!cancelled) {
          setProgressLabel('저장이 완료되었습니다. 아래 버튼을 눌러 메인으로 이동해주세요.');
          setSubmitState('done');
        }
      } catch (err) {
        if (!cancelled) {
          setSubmitState('error');
          setError(err.message || '온보딩 저장에 실패했습니다.');
        }
      }
    }

    submitOnboarding();

    return () => {
      cancelled = true;
    };
  }, [savedData, submitState]);

  const summary = useMemo(() => calculateSummary(savedData || {}), [savedData]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-cream-400 via-cream to-neutral-100 flex items-center justify-center p-6">
      <div className="w-[380px] min-h-[560px] bg-white rounded-xl shadow-modal flex flex-col justify-center p-8 text-center">
        <div className="text-[48px] mb-4">D</div>
        <h2 className="text-[22px] font-bold text-nature-900 mb-2">온보딩 완료</h2>
        <p className="text-[14px] text-neutral-400 mb-6">
          설문 결과를 저장하고 초기 건강 프로필을 생성하고 있습니다.
        </p>

        <div className="bg-cream-300 rounded-xl border border-cream-500 p-5 text-left mb-4">
          <h4 className="text-[14px] font-semibold text-nature-900 mb-3">요약</h4>
          <div className="flex justify-between py-1.5 border-b border-neutral-50">
            <span className="text-[13px] text-neutral-400">관계</span>
            <span className="text-[13px] font-medium text-nature-900">{summary.relation}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-neutral-50">
            <span className="text-[13px] text-neutral-400">BMI</span>
            <span className="text-[13px] font-medium text-nature-900">{summary.bmi}</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-[13px] text-neutral-400">운동 빈도</span>
            <span className="text-[13px] font-medium text-nature-900">{summary.exercise}</span>
          </div>
        </div>

        {submitState === 'submitting' && (
          <div className="rounded-xl px-5 py-3.5 mb-6 bg-cream-300 text-[14px] text-nature-900">
            {progressLabel}
          </div>
        )}

        {submitState === 'done' && (
          <div className="rounded-xl px-5 py-3.5 mb-6 bg-nature-50 text-[14px] text-nature-700">
            {progressLabel}
          </div>
        )}

        {submitState === 'error' && (
          <div className="rounded-xl px-5 py-3.5 mb-6 bg-red-50 text-[14px] text-red-600">
            {error}
          </div>
        )}

        <Link
          href="/app/chat"
          className={`inline-block w-full py-3.5 text-white text-[15px] font-semibold rounded-xl shadow-soft transition-all ${
            submitState === 'done' ? 'bg-nature-500 hover:bg-nature-600' : 'bg-neutral-300 pointer-events-none'
          }`}
        >
          메인으로 이동
        </Link>
      </div>
    </div>
  );
}
