'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

import { api, establishSession, getScopedStorageKey } from '../../../hooks/useApi';
import { ONBOARDING_THEME_VARS } from '../../../lib/onboardingTheme';
import { enablePushNotifications, getPushPermission } from '../../../lib/pushNotifications';
import { formatUserGroupDisplay } from '../../../lib/userGroupLabels';

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
const HEALTH_QUESTION_INTERVAL_MAP = [60, 90, 120, 0, null];

function mapArray(indices, mapper) {
  if (!Array.isArray(indices)) return [];
  return indices
    .map((index) => mapper[index])
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index);
}

function buildSurveyPayload(saved) {
  const lab = saved.lab || {};
  const interval = HEALTH_QUESTION_INTERVAL_MAP[saved.freq];

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
    health_question_interval_minutes: interval === null || interval === undefined ? 90 : interval,
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
  const [resultGroup, setResultGroup] = useState(null);
  const [pushPromptDismissed, setPushPromptDismissed] = useState(false);
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [pushSaving, setPushSaving] = useState(false);
  const [pushMessage, setPushMessage] = useState(null);
  const onboardingStorageKey = getScopedStorageKey('danaa_onboarding');
  const tutorialPendingKey = getScopedStorageKey('danaa_tutorial_pending');
  const riskStorageKey = getScopedStorageKey('danaa_risk');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(onboardingStorageKey);
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

        setResultGroup(status.user_group || null);
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
          await establishSession(surveyData.access_token);
        }

        try {
          localStorage.setItem(onboardingStorageKey, JSON.stringify(savedData));
          localStorage.setItem(tutorialPendingKey, 'true');
          if (surveyData.user_group || surveyData.initial_findrisc_score || surveyData.initial_risk_level) {
            localStorage.setItem(
              riskStorageKey,
              JSON.stringify({
                group: surveyData.user_group || null,
                score: surveyData.initial_findrisc_score || null,
                level: surveyData.initial_risk_level || null,
              }),
            );
          }
        } catch {}

        if (!cancelled) {
          setResultGroup(surveyData.user_group || null);
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
  }, [onboardingStorageKey, riskStorageKey, savedData, submitState, tutorialPendingKey]);

  const enableBrowserPush = async () => {
    setPushSaving(true);
    setPushMessage(null);
    try {
      await enablePushNotifications();
      setPushMessage({ type: 'success', text: '브라우저 알림을 켰어요. 선택한 주기에 맞춰 놓친 기록을 알려드릴게요.' });
      setPushPromptDismissed(true);
      window.setTimeout(() => setPushModalOpen(false), 900);
    } catch (err) {
      setPushMessage({ type: 'error', text: err?.message || '브라우저 알림을 켜지 못했어요.' });
    } finally {
      setPushSaving(false);
    }
  };

  const summary = useMemo(() => calculateSummary(savedData || {}), [savedData]);

  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center p-4 sm:p-6"
      style={{ ...ONBOARDING_THEME_VARS, background: 'var(--color-bg)' }}
    >
      <div
        className="flex min-h-[560px] w-full max-w-[380px] flex-col justify-center rounded-xl p-6 text-center shadow-modal sm:p-8"
        style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="text-[48px] mb-4" style={{ color: 'var(--color-text)' }}>D</div>
        <h2 className="text-[22px] font-bold mb-2" style={{ color: 'var(--color-text)' }}>온보딩 완료</h2>
        <p className="text-[14px] mb-6" style={{ color: 'var(--color-text-muted)' }}>
          설문 결과를 저장하고 초기 건강 프로필을 생성하고 있습니다.
        </p>

        <div
          className="rounded-xl p-5 text-left mb-4"
          style={{
            background: 'var(--color-surface-hover)',
            border: '1px solid var(--color-border-light)',
          }}
        >
          <h4 className="text-[14px] font-semibold mb-3" style={{ color: 'var(--color-text)' }}>요약</h4>
          <div className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <span className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>관계</span>
            <span className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>{summary.relation}</span>
          </div>
          <div className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
            <span className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>BMI</span>
            <span className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>{summary.bmi}</span>
          </div>
          {resultGroup && (
            <div className="flex justify-between py-1.5" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
              <span className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>관리 단계</span>
              <span className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>{formatUserGroupDisplay(resultGroup)}</span>
            </div>
          )}
          <div className="flex justify-between py-1.5">
            <span className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>운동 빈도</span>
            <span className="text-[13px] font-medium" style={{ color: 'var(--color-text)' }}>{summary.exercise}</span>
          </div>
        </div>

        {submitState === 'submitting' && (
          <div
            className="rounded-xl px-5 py-3.5 mb-6 text-[14px]"
            style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-secondary)' }}
          >
            {progressLabel}
          </div>
        )}

        {submitState === 'done' && (
          <div
            className="rounded-xl px-5 py-3.5 mb-6 text-[14px]"
            style={{ background: '#E6F4EA', color: '#1E5631' }}
          >
            {progressLabel}
          </div>
        )}

        {submitState === 'done' && !pushPromptDismissed && getPushPermission() !== 'granted' && (
          <div
            className="rounded-xl px-4 py-3 mb-4 text-left"
            style={{
              background: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border-light)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[14px] font-semibold" style={{ color: 'var(--color-text)' }}>
                  건강 기록 알림
                </div>
                <div className="text-[12px] leading-5" style={{ color: 'var(--color-text-muted)' }}>
                  선택한 주기에 맞춰 미입력 질문을 알려드려요.
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPushMessage(null);
                  setPushModalOpen(true);
                }}
                disabled={pushSaving}
                className="shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold disabled:opacity-50"
                style={{ background: 'var(--color-cta-bg)', color: 'var(--color-cta-text)' }}
              >
                설정
              </button>
            </div>
          </div>
        )}

        {pushModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
            <div
              className="w-full max-w-[360px] rounded-xl p-5 text-left shadow-modal"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <div className="text-[17px] font-bold mb-2" style={{ color: 'var(--color-text)' }}>
                브라우저 알림을 켤까요?
              </div>
              <div className="text-[13px] leading-6 mb-4" style={{ color: 'var(--color-text-muted)' }}>
                다른 사이트를 보고 있어도 지나간 시간대의 미입력 질문만 알려드려요. 브라우저 권한 창에서 허용을 선택하면 알림이 등록됩니다.
              </div>
              {pushMessage && (
                <div
                  className="mb-3 rounded-lg px-3 py-2 text-[12px]"
                  style={{
                    background: pushMessage.type === 'success' ? '#E6F4EA' : '#FDECEC',
                    color: pushMessage.type === 'success' ? '#1E5631' : '#B42318',
                  }}
                >
                  {pushMessage.text}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPushPromptDismissed(true);
                    setPushModalOpen(false);
                  }}
                  disabled={pushSaving}
                  className="rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-50"
                  style={{
                    background: 'var(--color-surface-hover)',
                    color: 'var(--color-text-muted)',
                    border: '1px solid var(--color-border-light)',
                  }}
                >
                  나중에
                </button>
                <button
                  type="button"
                  onClick={enableBrowserPush}
                  disabled={pushSaving}
                  className="rounded-lg px-3.5 py-2 text-[13px] font-semibold disabled:opacity-50"
                  style={{ background: 'var(--color-cta-bg)', color: 'var(--color-cta-text)' }}
                >
                  {pushSaving ? '처리 중' : '알림 켜기'}
                </button>
              </div>
            </div>
          </div>
        )}

        {pushMessage && !pushModalOpen && pushPromptDismissed && (
              <div
                className="rounded-xl px-5 py-3.5 mb-4 text-[13px]"
                style={{
                  background: pushMessage.type === 'success' ? '#E6F4EA' : '#FDECEC',
                  color: pushMessage.type === 'success' ? '#1E5631' : '#B42318',
                }}
              >
                {pushMessage.text}
              </div>
        )}

        {submitState === 'error' && (
          <div
            className="rounded-xl px-5 py-3.5 mb-6 text-[14px]"
            style={{ background: '#FDECEC', color: '#B42318' }}
          >
            {error}
          </div>
        )}

        <Link
          href="/app/chat"
          className={`inline-block w-full py-3.5 text-[15px] font-semibold rounded-xl shadow-soft transition-all ${
            submitState === 'done' ? '' : 'pointer-events-none'
          }`}
          style={{
            background: submitState === 'done' ? 'var(--color-cta-bg)' : 'var(--color-border)',
            color: submitState === 'done' ? 'var(--color-cta-text)' : 'var(--color-text-muted)',
          }}
        >
          메인으로 이동
        </Link>
      </div>
    </div>
  );
}
