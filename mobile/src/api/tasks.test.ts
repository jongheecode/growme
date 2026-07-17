import { listTasks, createTask, completeTask, deleteTask } from './tasks';

describe('listTasks', () => {
  it('returns the parsed task list', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => [{ id: '1', title: 'a' }] })
    ) as unknown as typeof fetch;
    const tasks = await listTasks();
    expect(tasks).toEqual([{ id: '1', title: 'a' }]);
  });

  it('throws when the response is not ok', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(listTasks()).rejects.toThrow('할일 목록을 불러오지 못했어요');
  });
});

describe('createTask', () => {
  it('posts the task fields and returns the created task', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ id: '1', title: '운동하기' }) })
    ) as unknown as typeof fetch;
    const task = await createTask('운동하기', 'EXERCISE', 'MEDIUM', 'TODAY');
    expect(task.title).toBe('운동하기');
  });
});

describe('completeTask', () => {
  it('returns the updated task', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: async () => ({ id: '1', status: 'COMPLETED' }) })
    ) as unknown as typeof fetch;
    const task = await completeTask('1');
    expect(task.status).toBe('COMPLETED');
  });

  it('throws a specific message when the task has expired', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 409, json: async () => ({ error: 'task expired' }) })
    ) as unknown as typeof fetch;
    await expect(completeTask('1')).rejects.toThrow('이미 기한이 지났습니다');
  });

  it('throws a generic message for other failures', async () => {
    globalThis.fetch = jest.fn(() =>
      Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
    ) as unknown as typeof fetch;
    await expect(completeTask('1')).rejects.toThrow('할일을 완료하지 못했어요');
  });
});

describe('deleteTask', () => {
  it('resolves when the response is ok', async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({ ok: true, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(deleteTask('1')).resolves.toBeUndefined();
  });
});

describe('createTask with goalId', () => {
  it('includes goalId in the request body when provided', async () => {
    let capturedBody: string | undefined;
    globalThis.fetch = jest.fn((_url: string, options?: RequestInit) => {
      capturedBody = options?.body as string;
      return Promise.resolve({ ok: true, json: async () => ({ id: '1', title: '운동하기' }) });
    }) as unknown as typeof fetch;

    await createTask('운동하기', 'EXERCISE', 'MEDIUM', 'TODAY', 'goal-1');
    expect(JSON.parse(capturedBody!).goalId).toBe('goal-1');
  });

  it('omits goalId from the request body when not provided', async () => {
    let capturedBody: string | undefined;
    globalThis.fetch = jest.fn((_url: string, options?: RequestInit) => {
      capturedBody = options?.body as string;
      return Promise.resolve({ ok: true, json: async () => ({ id: '1', title: '운동하기' }) });
    }) as unknown as typeof fetch;

    await createTask('운동하기', 'EXERCISE', 'MEDIUM', 'TODAY');
    expect(JSON.parse(capturedBody!).goalId).toBeUndefined();
  });
});
