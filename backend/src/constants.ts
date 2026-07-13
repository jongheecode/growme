export const HEARTBEAT_INTERVAL_SECONDS = 30;
export const MAX_GAP_SECONDS = 300; // 5분 이상 끊기면 그 이후는 인증 안 함
export const DECAY_START_DAYS = 3; // 3일째부터 하락 시작 (2일 연속 무기록 후)
export const DECAY_RATE = 0.1; // 하루당 10% 감소
export const STAGE_THRESHOLDS = [0, 3600, 3 * 3600, 10 * 3600, 30 * 3600]; // 알,1,2,3,4단계 (초)
