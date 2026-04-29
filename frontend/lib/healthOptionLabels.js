export const SLEEP_QUALITY_OPTIONS = [
  { value: 'very_good', label: '푹 잤어요' },
  { value: 'good', label: '잘 잤어요' },
  { value: 'normal', label: '조금 뒤척였어요' },
  { value: 'bad', label: '자주 깼어요' },
  { value: 'very_bad', label: '거의 못 잤어요' },
];

export const SLEEP_DURATION_OPTIONS = [
  { value: 'under_5', label: '5시간 미만' },
  { value: 'between_5_6', label: '5~6시간' },
  { value: 'between_6_7', label: '6~7시간' },
  { value: 'between_7_8', label: '7~8시간' },
  { value: 'over_8', label: '8시간 이상' },
];

export const MEAL_STATUS_OPTIONS = [
  { value: 'hearty', label: '먹었어요' },
  { value: 'skipped', label: '못 먹었어요' },
];

export const MEDICATION_OPTIONS = [
  { value: true, label: '복용했어요' },
  { value: false, label: '아직 못 먹었어요' },
];

export const EXERCISE_DONE_OPTIONS = [
  { value: true, label: '했어요' },
  { value: false, label: '못 했어요' },
];

export const MOOD_OPTIONS = [
  { value: 'very_good', label: '아주 좋음' },
  { value: 'good', label: '좋음' },
  { value: 'normal', label: '보통' },
  { value: 'stressed', label: '스트레스' },
  { value: 'very_stressed', label: '많이 지침' },
];

export const ALCOHOL_OPTIONS = [
  { value: false, label: '안 마셨어요' },
  { value: true, label: '마셨어요' },
];

export const WATER_OPTIONS = Array.from({ length: 11 }, (_, n) => ({
  value: n,
  label: n === 10 ? '10잔 이상' : `${n}잔`,
}));

export const EXERCISE_TYPE_LABELS = {
  walking: '걷기 산책',
  running: '달리기',
  cycling: '자전거',
  swimming: '수영',
  gym: '헬스',
  home_workout: '홈트',
  other: '기타',
};

export const SLEEP_QUALITY_LABELS = Object.fromEntries(
  SLEEP_QUALITY_OPTIONS.map((option) => [option.value, option.label]),
);

export const SLEEP_DURATION_LABELS = Object.fromEntries(
  SLEEP_DURATION_OPTIONS.map((option) => [option.value, option.label]),
);

export const MOOD_LABELS = Object.fromEntries(
  MOOD_OPTIONS.map((option) => [option.value, option.label]),
);
