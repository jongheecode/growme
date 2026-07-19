import { describe, it, expect, vi, beforeEach } from 'vitest';

const { MockAnthropic } = vi.hoisted(() => ({ MockAnthropic: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic,
}));

describe('getAnthropicClient', () => {
  beforeEach(() => {
    vi.resetModules();
    MockAnthropic.mockClear();
  });

  it('constructs the client only once across multiple calls (lazy singleton)', async () => {
    const { getAnthropicClient } = await import('./anthropicClient');
    getAnthropicClient();
    getAnthropicClient();
    expect(MockAnthropic).toHaveBeenCalledTimes(1);
  });

  it('passes ANTHROPIC_API_KEY from the environment', async () => {
    const { getAnthropicClient } = await import('./anthropicClient');
    process.env.ANTHROPIC_API_KEY = 'test-key';
    getAnthropicClient();
    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'test-key' });
  });
});
