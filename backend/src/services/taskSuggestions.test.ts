import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      messages: { create: mockCreate },
    })),
  };
});

import { suggestTasks } from './taskSuggestions';

beforeEach(() => {
  mockCreate.mockReset();
});

describe('suggestTasks', () => {
  it('parses valid suggestions from the tool call', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'suggest_tasks',
          input: {
            suggestions: [
              { title: '리스닝 20분', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' },
              { title: '단어 암기', category: 'STUDY', difficulty: 'MEDIUM', dueChoice: 'THIS_WEEK' },
            ],
          },
        },
      ],
    });
    const result = await suggestTasks({ title: '매일 영어 공부', category: 'STUDY' });
    expect(result).toEqual([
      { title: '리스닝 20분', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' },
      { title: '단어 암기', category: 'STUDY', difficulty: 'MEDIUM', dueChoice: 'THIS_WEEK' },
    ]);
  });

  it('drops suggestions with an invalid category, keeping valid ones', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'tool_use',
          name: 'suggest_tasks',
          input: {
            suggestions: [
              { title: '유효함', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' },
              { title: '무효함', category: 'NOT_REAL', difficulty: 'EASY', dueChoice: 'TODAY' },
            ],
          },
        },
      ],
    });
    const result = await suggestTasks({ title: '목표', category: 'STUDY' });
    expect(result).toEqual([{ title: '유효함', category: 'STUDY', difficulty: 'EASY', dueChoice: 'TODAY' }]);
  });

  it('returns an empty array when the model does not call the tool', async () => {
    mockCreate.mockResolvedValue({ content: [{ type: 'text', text: '음...' }] });
    const result = await suggestTasks({ title: '목표', category: 'STUDY' });
    expect(result).toEqual([]);
  });

  it('propagates an error when the Anthropic call fails', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));
    await expect(suggestTasks({ title: '목표', category: 'STUDY' })).rejects.toThrow('rate limited');
  });
});
