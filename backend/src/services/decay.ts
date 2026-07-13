import { DECAY_START_DAYS, DECAY_RATE } from '../constants';

export function computeDecayedGauge(currentGauge: number, lastActiveDate: Date, now: Date): number {
  const daysSince = Math.floor((now.getTime() - lastActiveDate.getTime()) / 86_400_000);
  if (daysSince < DECAY_START_DAYS) return currentGauge;
  const decayDays = daysSince - (DECAY_START_DAYS - 1);
  let gauge = currentGauge;
  for (let i = 0; i < decayDays; i++) {
    gauge = Math.floor(gauge * (1 - DECAY_RATE));
  }
  return Math.max(gauge, 0);
}
