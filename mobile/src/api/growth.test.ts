import { getGrowth } from './growth';

describe('getGrowth', () => {
  it('returns the parsed growth state', async () => {
    const body = { totalXp: 10, species: null, stage: 0, xpIntoStage: 0, xpToNextStage: null, personality: null };
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => body })) as unknown as typeof fetch;
    const growth = await getGrowth();
    expect(growth).toEqual(body);
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(getGrowth()).rejects.toThrow('꾸미 정보를 불러오지 못했어요');
  });
});
