import { describe, it, expect } from 'vitest';
import { computeDecayedGauge } from './decay';

describe('computeDecayedGauge', () => {
  it('does not decay before day 3', () => {
    const lastActive = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-02T12:00:00Z'); // 1일 경과
    expect(computeDecayedGauge(1000, lastActive, now)).toBe(1000);
  });

  it('decays starting from day 3', () => {
    const lastActive = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-04T00:00:00Z'); // 3일 경과
    expect(computeDecayedGauge(1000, lastActive, now)).toBe(900);
  });

  it('compounds decay for multiple days', () => {
    const lastActive = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2026-01-05T00:00:00Z'); // 4일 경과 -> 2일치 감소
    expect(computeDecayedGauge(1000, lastActive, now)).toBe(810);
  });

  it('never goes below 0', () => {
    const lastActive = new Date('2026-01-01T00:00:00Z');
    const now = new Date('2027-01-01T00:00:00Z');
    expect(computeDecayedGauge(5, lastActive, now)).toBe(0);
  });
});
