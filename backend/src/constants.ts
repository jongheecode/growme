import { Category } from '@prisma/client';

export const HEARTBEAT_INTERVAL_SECONDS = 30;
export const MAX_GAP_SECONDS = 300; // 5분 이상 끊기면 그 이후는 인증 안 함

// 카테고리별 권장 집중 시간(분). 미션 완료 시 집중 타이머 인증 시간이
// 이 값 이상이면 XP 보너스를 준다. mobile/src/theme.ts의 categoryMeta와
// 값을 맞춰서 관리한다(둘 다 정적 상수라 공유 패키지 없이 수동 동기화).
export const RECOMMENDED_MINUTES: Record<Category, number> = {
  EXERCISE: 30,
  STUDY: 45,
  READING: 60,
  ETC: 20,
};

export const TIMER_BONUS_MULTIPLIER = 1.2;
