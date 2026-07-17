import { listGoals, sendGoalChatMessage } from './goals';

describe('listGoals', () => {
  it('returns the parsed goal list', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => [{ id: '1', title: '목표', category: 'STUDY', createdAt: 'x' }] })
    ) as unknown as typeof fetch;
    const goals = await listGoals();
    expect(goals).toEqual([{ id: '1', title: '목표', category: 'STUDY', createdAt: 'x' }]);
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(listGoals()).rejects.toThrow('목표 목록을 불러오지 못했어요');
  });
});

describe('sendGoalChatMessage', () => {
  it('returns the chat result on success', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ reply: '안녕!', goalSet: false }) })
    ) as unknown as typeof fetch;
    const result = await sendGoalChatMessage([{ role: 'user', content: '안녕' }]);
    expect(result.reply).toBe('안녕!');
    expect(result.goalSet).toBe(false);
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(sendGoalChatMessage([{ role: 'user', content: 'x' }])).rejects.toThrow('메시지를 보내지 못했어요');
  });
});
