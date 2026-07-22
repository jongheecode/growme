export const colors = {
  background: '#FBF6EE',
  card: '#FFFDF9',
  border: '#ECE1D2',
  ink: '#4A4038',
  inkMuted: '#8A7E72',
  inkFaint: '#B0A493',
  green: '#5FA97D',
  greenDark: '#4A8863',
  greenTint: '#F0F8F2',
  gold: '#F3C969',
  goldText: '#B58A2E',
  goldTint: '#FFF6E0',
  lavender: '#B7A6E4',
  peach: '#EE9E86',
  fail: '#C88A72',
  failTint: '#F5EDE9',
} as const;

export const fonts = {
  heading: 'Jua_400Regular',
  body: 'GowunDodum_400Regular',
} as const;

export const speciesPalette = {
  mint: { body: '#8FD1A6', lite: '#B8E4C6', dark: '#5FA97D', cheek: '#F2A98F', shell: '#DDF0E2' },
  peach: { body: '#F6B396', lite: '#FBD3C0', dark: '#E08862', cheek: '#EE9E86', shell: '#FBE4D8' },
  lav: { body: '#B7A6E4', lite: '#D6CCF2', dark: '#9179CC', cheek: '#F2A98F', shell: '#E6DEF6' },
} as const;

export type DesignSpecies = keyof typeof speciesPalette;

// 백엔드 backend/src/constants.ts의 RECOMMENDED_MINUTES와 값을 맞춰서
// 관리한다(둘 다 정적 상수라 공유 패키지 없이 수동 동기화).
export const categoryMeta = {
  EXERCISE: { label: '운동', color: '#EE9E86', recommendedMinutes: 30 },
  STUDY: { label: '공부', color: '#6FA8D8', recommendedMinutes: 45 },
  READING: { label: '독서', color: '#B7A6E4', recommendedMinutes: 60 },
  ETC: { label: '기타', color: '#F3C969', recommendedMinutes: 20 },
} as const;

export const difficultyLabel = {
  EASY: '쉬움',
  MEDIUM: '보통',
  HARD: '어려움',
} as const;
