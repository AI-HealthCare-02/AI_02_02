'use client';

import { memo, useCallback, useMemo, useState } from 'react';

function isQuestionVisible(question, answers) {
  const condition = question?.condition;
  if (!condition) return true;

  if (condition.endsWith('_true')) {
    const field = condition.slice(0, -5);
    return answers[field] === true;
  }

  return false;
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

const InlineHealthQuestionCard = memo(function InlineHealthQuestionCard({
  bundleKey,
  bundleName,
  questions,
  onSubmit,
  formatOptionLabel,
}) {
  const [answers, setAnswers] = useState({});
  const [savedFields, setSavedFields] = useState([]);
  const [skippedFields, setSkippedFields] = useState([]);
  const [pendingField, setPendingField] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const visibleQuestions = useMemo(
    () =>
      (questions || []).filter(
        (question) =>
          (question.inputType || 'select') === 'select' &&
          Array.isArray(question.options) &&
          question.options.length > 0 &&
          isQuestionVisible(question, answers),
      ),
    [answers, questions],
  );

  const isComplete = useMemo(
    () =>
      visibleQuestions.length > 0 &&
      visibleQuestions.every(
        (question) =>
          savedFields.includes(question.field) || skippedFields.includes(question.field),
      ),
    [savedFields, skippedFields, visibleQuestions],
  );

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
      } catch (error) {
        setErrorMessage(error?.message || '저장 중 문제가 생겼어요.');
      } finally {
        setPendingField(null);
      }
    },
    [answers, bundleKey, onSubmit],
  );

  return (
    <div className="rounded-2xl border border-cream-500 bg-white px-4 py-3 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[12px] font-semibold text-nature-900">{bundleName}</div>
          <div className="text-[11px] text-neutral-400">대화 흐름에서 바로 오늘 기록을 남겨볼 수 있어요.</div>
        </div>
        {isComplete && <div className="text-[11px] font-medium text-emerald-600">오늘 기록 완료</div>}
      </div>

      <div className="mt-3 space-y-4">
        {visibleQuestions.map((question) => {
          const isSaved = savedFields.includes(question.field);
          const isSkipped = skippedFields.includes(question.field);
          const isPending = pendingField === question.field;

          return (
            <div key={question.field} className="space-y-2">
              <div className="text-[12px] font-medium text-nature-900">{question.text}</div>
              <div className="flex flex-wrap gap-2">
                {question.options.map((option) => {
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
              {isSaved && <div className="text-[11px] text-emerald-600">오늘 기록에 저장됐어요.</div>}
              {!isSaved && isSkipped && <div className="text-[11px] text-neutral-400">오늘 이미 답한 항목이에요.</div>}
            </div>
          );
        })}
      </div>

      {errorMessage && <div className="mt-3 text-[11px] text-red-500">{errorMessage}</div>}
    </div>
  );
});

export default InlineHealthQuestionCard;
