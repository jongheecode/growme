import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

import { generateReaction } from './reactions';

beforeEach(() => {
  mockCreate.mockReset();
});

describe('generateReaction', () => {
  it('returns the text block from a completed reaction', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '잘했어! 대단해!' }] });
    const result = await generateReaction({ title: '리스닝 20분' }, null, 'COMPLETED');
    expect(result).toBe('잘했어! 대단해!');
  });

  it('falls back to a neutral prompt when personality is null', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    await generateReaction({ title: 'x' }, null, 'COMPLETED');
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('아직 사용자의 성격 유형을 알 수 없어');
  });

  it('includes STEADY/EASYGOING personality description in the prompt', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    await generateReaction({ title: 'x' }, { axisA: 'STEADY', axisB: 'EASYGOING', type: 'STEADY_EASYGOING' }, 'COMPLETED');
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('꾸준한 편');
    expect(call.system).toContain('여유있게');
  });

  it('includes LOOSE/LASTMINUTE personality description in the prompt', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] });
    await generateReaction({ title: 'x' }, { axisA: 'LOOSE', axisB: 'LASTMINUTE', type: 'LOOSE_LASTMINUTE' }, 'FAILED');
    const call = mockCreate.mock.calls[0][0];
    expect(call.system).toContain('느슨한 편');
    expect(call.system).toContain('막판에 몰아치는 편');
  });

  it('throws when the response has no text block', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'tool_use', name: 'irrelevant', input: {} }] });
    await expect(generateReaction({ title: 'x' }, null, 'COMPLETED')).rejects.toThrow('no reaction text returned');
  });

  it('propagates an error when the Anthropic call fails', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    await expect(generateReaction({ title: 'x' }, null, 'FAILED')).rejects.toThrow('rate limited');
  });
});
