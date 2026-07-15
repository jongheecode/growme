import { describe, it, expect } from 'vitest';
import { computeCurrentStreak } from './streak';

describe('computeCurrentStreak', () => {
  it('returns 0 when today has no verified time', () => {
    const today = new Date('2026-07-15T12:00:00Z');
    expect(computeCurrentStreak({}, today)).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const today = new Date('2026-07-15T12:00:00Z');
    const totals = {
      '2026-07-15': 600,
      '2026-07-14': 900,
      '2026-07-13': 300,
      '2026-07-11': 500,
    };
    expect(computeCurrentStreak(totals, today)).toBe(3);
  });

  it('treats a zero-second day the same as a missing day', () => {
    const today = new Date('2026-07-15T12:00:00Z');
    const totals = {
      '2026-07-15': 600,
      '2026-07-14': 0,
      '2026-07-13': 900,
    };
    expect(computeCurrentStreak(totals, today)).toBe(1);
  });
});
