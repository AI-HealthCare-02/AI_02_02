'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';

function isQuestionVisible(question, answers) {
  const condition = question?.condition;
  if (!condition) return true;

  if (condition === 'group_A_only' || condition === '48h_since_last') {
    return true;
  }

  if (condition.endsWith('_true')) {
    const field = condition.slice(0, -5);
    return answers[field] === true;
  }

  return true;
}

function buildNextAnswers(currentAnswers, field, value) {
  const nextAnswers = {
    ...currentAnswers,
    [field]: value,
  };

  if (field === 'exercise_done' && value === false) {
    delete nextAnswers.exercise_type;
    delete nextAnswers.exercise_minutes;
  }

  if (field === 'alcohol_today' && value === false) {
    delete nextAnswers.alcohol_amount_level;
  }

  return nextAnswers;
}

function getNumberStep(field) {
  if (field === 'exercise_minutes') return 10;
  if (field === 'water_cups') return 1;
  return 1;
}

function getNumberMax(field) {
  if (field === 'exercise_minutes') return 300;
  if (field === 'water_cups') return 12;
  return 999;
}

const InlineHealthQuestionCard = memo(function InlineHealthQuestionCard({
  bundleKey,
  bundleName,
  questions,
  onSubmit,
  formatOptionLabel,
  initialAnswers = {},
  initialSavedFields = [],
  onComplete,
  helperText = '답변 흐름을 끊지 않고 바로 오늘 기록에 반영할 수 있어요.',
}) {
  const [answers, setAnswers] = useState(initialAnswers);
  const [savedFields, setSavedFields] = useState(initialSavedFields);
  const [skippedFields, setSkippedFields] = useState([]);
  const [pendingField, setPendingField] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setAnswers(initialAnswers);
    setSavedFields(initialSavedFields);
    setSkippedFields([]);
    setPendingField(null);
    setErrorMessage('');
  }, [bundleKey, initialAnswers, initialSavedFields, questions]);

  const visibleQuestions = useMemo(
    () =>
      (questions || []).filter((question) => isQuestionVisible(question, answers)),
    [answers, questions],
  );

  const pendingQuestions = useMemo(
    () =>
      visibleQuestions.filter(
        (question) =>
          !savedFields.includes(question.field) &&
          !skippedFields.includes(question.field),
      ),
    [savedFields, skippedFields, visibleQuestions],
  );

  const isComplete = pendingQuestions.length === 0;

  useEffect(() => {
    if (isComplete && typeof onComplete === 'function') {
      onComplete(bundleKey);
    }
  }, [bundleKey, isComplete, onComplete]);

  const applySubmitResult = useCallback((result) => {
    const nextSavedFields = Array.isArray(result?.saved_fields) ? result.saved_fields : [];
    const nextSkippedFields = Array.isArray(result?.skipped_fields) ? result.skipped_fields : [];

    if (nextSavedFields.length > 0) {
      setSavedFields((prev) => [...new Set([...prev, ...nextSavedFields])]);
    }

    if (nextSkippedFields.length > 0) {
      setSkippedFields((prev) => [...new Set([...prev, ...nextSkippedFields])]);
    }

    if (nextSavedFields.length === 0 && nextSkippedFields.length === 0) {
      setErrorMessage('저장 결과를 확인하는 중 문제가 생겼어요.');
    }
  }, []);

  const handleOptionClick = useCallback(
    async (question, option) => {
      const nextAnswers = buildNextAnswers(answers, question.field, option);
      setAnswers(nextAnswers);
      setErrorMessage('');
      setPendingField(question.field);

      try {
        const result = await onSubmit(bundleKey, {
          [question.field]: option,
        });
        applySubmitResult(result);
      } catch (error) {
        setErrorMessage(error?.message || '저장 중 문제가 생겼어요.');
      } finally {
        setPendingField(null);
      }
    },
    [answers, applySubmitResult, bundleKey, onSubmit],
  );

  const handleNumberAdjust = useCallback((field, delta) => {
    setAnswers((prev) => {
      const current = Number(prev?.[field] ?? initialAnswers?.[field] ?? 0);
      const nextValue = Math.max(0, Math.min(getNumberMax(field), current + delta));
      return buildNextAnswers(prev, field, nextValue);
    });
  }, [initialAnswers]);

  const handleNumberInput = useCallback((field, rawValue) => {
    const numeric = Number(rawValue);
    setAnswers((prev) => buildNextAnswers(
      prev,
      field,
      Number.isFinite(numeric) ? Math.max(0, Math.min(getNumberMax(field), numeric)) : 0,
    ));
  }, []);

  const handleNumberSave = useCallback(
    async (question) => {
      const value = Number(answers?.[question.field] ?? initialAnswers?.[question.field] ?? 0);
      setErrorMessage('');
      setPendingField(question.field);

      try {
        const result = await onSubmit(bundleKey, {
          [question.field]: value,
        });
        applySubmitResult(result);
      } catch (error) {
        setErrorMessage(error?.message || '저장 중 문제가 생겼어요.');
      } finally {
        setPendingField(null);
      }
    },
    [answers, applySubmitResult, bundleKey, initialAnswers, onSubmit],
  );

  return (
    <div className="rounded-2xl border border-cream-500 bg-white px-4 py-3 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold text-nature-900">{bundleName}</div>
          <div className="text-[11px] text-neutral-400">{helperText}</div>
        </div>
        {isComplete && <div className="text-[11px] font-medium text-emerald-600">오늘 기록 완료</div>}
      </div>

      <div className="mt-3 space-y-4">
        {pendingQuestions.map((question) => {
          const isPending = pendingField === question.field;
          const inputType = question.inputType || question.input_type || 'select';

          if (inputType === 'number') {
            const step = getNumberStep(question.field);
            const value = Number(answers?.[question.field] ?? initialAnswers?.[question.field] ?? 0);

            return (
              <div key={question.field} className="space-y-2">
                <div className="text-[12px] font-medium text-nature-900">{question.text}</div>
                <div className="rounded-xl bg-cream-300 px-3 py-3">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleNumberAdjust(question.field, -step)}
                      disabled={isPending}
                      className="w-8 h-8 rounded-full border border-cream-500 bg-white text-neutral-400 hover:bg-black/[.03] disabled:cursor-wait disabled:opacity-60"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="0"
                      max={String(getNumberMax(question.field))}
                      step={String(step)}
                      value={value}
                      onChange={(event) => handleNumberInput(question.field, event.target.value)}
                      disabled={isPending}
                      className="w-20 rounded-lg border border-cream-500 bg-white px-2 py-1 text-center text-[14px] font-semibold text-nature-900 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleNumberAdjust(question.field, step)}
                      disabled={isPending}
                      className="w-8 h-8 rounded-full border border-cream-500 bg-white text-neutral-400 hover:bg-black/[.03] disabled:cursor-wait disabled:opacity-60"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNumberSave(question)}
                    disabled={isPending}
                    className="mt-3 w-full rounded-lg bg-nature-900 px-3 py-2 text-[11px] font-medium text-white hover:bg-nature-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isPending ? '저장 중...' : '이 값으로 저장'}
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={question.field} className="space-y-2">
              <div className="text-[12px] font-medium text-nature-900">{question.text}</div>
              <div className="flex flex-wrap gap-2">
                {(question.options || []).map((option) => {
                  const isActive = answers[question.field] === option;

                  return (
                    <button
                      key={`${question.field}-${String(option)}`}
                      type="button"
                      onClick={() => handleOptionClick(question, option)}
                      disabled={isPending}
                      aria-pressed={isActive}
                      className={`rounded-full border px-3 py-1.5 text-[11px] transition-all ${
                        isActive
                          ? 'border-nature-900 bg-nature-900 text-white'
                          : 'border-cream-500 bg-cream-300 text-nature-900 hover:border-nature-500'
                      } ${isPending ? 'cursor-wait opacity-60' : ''}`}
                    >
                      {formatOptionLabel(option)}
                    </button>
                  );
                })}
              </div>
              {isPending && <div className="text-[11px] text-neutral-400">저장 중...</div>}
            </div>
          );
        })}
      </div>

      {pendingQuestions.length === 0 && (
        <div className="mt-3 rounded-lg bg-cream-300 px-3 py-2 text-[11px] text-neutral-400">
          이 묶음은 오늘 기록 기준으로 이미 채워져 있어요.
        </div>
      )}

      {errorMessage && <div className="mt-3 text-[11px] text-red-500">{errorMessage}</div>}
    </div>
  );
});

export default InlineHealthQuestionCard;
