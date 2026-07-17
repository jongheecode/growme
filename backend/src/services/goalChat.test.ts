import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

import { runGoalChat } from './goalChat';

beforeEach(() => {
  mockCreate.mockReset();
});

describe('runGoalChat', () => {
  it('returns goalInput:null for a plain text reply', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: '요즘 어떤 게 고민이야?' }],
    });
    const result = await runGoalChat([{ role: 'user', content: '안녕' }]);
    expect(result.reply).toBe('요즘 어떤 게 고민이야?');
    expect(result.goalInput).toBeNull();
  });

  it('extracts the goal when the model calls set_goal with valid input', async () => {
    mockCreate.mockResolvedValue({
      content: [
        { type: 'text', text: '좋아, 목표를 정했어!' },
        { type: 'tool_use', name: 'set_goal', input: { title: '매일 영어 리스닝', category: 'STUDY' } },
      ],
    });
    const result = await runGoalChat([{ role: 'user', content: '영어 공부 습관 만들고 싶어' }]);
    expect(result.reply).toBe('좋아, 목표를 정했어!');
    expect(result.goalInput).toEqual({ title: '매일 영어 리스닝', category: 'STUDY' });
  });

  it('ignores a tool call with an invalid category', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'set_goal', input: { title: 'x', category: 'NOT_REAL' } }],
    });
    const result = await runGoalChat([{ role: 'user', content: 'x' }]);
    expect(result.goalInput).toBeNull();
  });

  it('ignores a tool call with a missing title', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'set_goal', input: { category: 'STUDY' } }],
    });
    const result = await runGoalChat([{ role: 'user', content: 'x' }]);
    expect(result.goalInput).toBeNull();
  });

  it('falls back to a default reply when there is no text block alongside a tool call', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'tool_use', name: 'set_goal', input: { title: '독서 습관', category: 'READING' } }],
    });
    const result = await runGoalChat([{ role: 'user', content: 'x' }]);
    expect(result.reply.length).toBeGreaterThan(0);
    expect(result.goalInput).toEqual({ title: '독서 습관', category: 'READING' });
  });

  it('propagates an error when the Anthropic call fails', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    await expect(runGoalChat([{ role: 'user', content: 'x' }])).rejects.toThrow('rate limited');
  });
});
