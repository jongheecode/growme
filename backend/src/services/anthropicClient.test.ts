import { describe, it, expect, vi, beforeEach } from 'vitest';

const { MockAnthropic } = vi.hoisted(() => ({ MockAnthropic: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic,
}));

import { getAnthropicClient, resetAnthropicClient } from './anthropicClient';

beforeEach(() => {
  MockAnthropic.mockClear();
  resetAnthropicClient();
});

describe('getAnthropicClient', () => {
  it('constructs the client only once across multiple calls (lazy singleton)', () => {
    getAnthropicClient();
    getAnthropicClient();
    expect(MockAnthropic).toHaveBeenCalledTimes(1);
  });

  it('passes ANTHROPIC_API_KEY from the environment', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    getAnthropicClient();
    expect(MockAnthropic).toHaveBeenCalledWith({ apiKey: 'test-key' });
  });
});
