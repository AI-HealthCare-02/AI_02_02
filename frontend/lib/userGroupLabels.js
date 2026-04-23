export const USER_GROUP_LABELS = {
  A: '집중 관리 단계',
  B: '주의 관리 단계',
  C: '일반 관리 단계',
};

export function formatUserGroupLabel(group, fallback = '일반 관리 단계') {
  if (!group) return fallback;
  const key = String(group).trim().toUpperCase();
  return USER_GROUP_LABELS[key] || fallback;
}

export function formatUserGroupDisplay(group, fallback = '온보딩 완료') {
  if (!group) return fallback;
  const key = String(group).trim().toUpperCase();
  const label = USER_GROUP_LABELS[key];
  return label ? `${key}그룹(${label})` : fallback;
}
