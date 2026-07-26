import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockInit, mockCaptureException } = vi.hoisted(() => ({
  mockInit: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('@sentry/node', () => ({
  init: mockInit,
  captureException: mockCaptureException,
}));

describe('sentry service', () => {
  const originalDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    vi.resetModules();
    mockInit.mockClear();
    mockCaptureException.mockClear();
  });

  afterEach(() => {
    process.env.SENTRY_DSN = originalDsn;
  });

  it('does not initialize Sentry when SENTRY_DSN is empty', async () => {
    delete process.env.SENTRY_DSN;
    const { initSentry } = await import('./sentry');
    initSentry();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('initializes Sentry once when SENTRY_DSN is set, even across repeated calls', async () => {
    process.env.SENTRY_DSN = 'https://example.ingest.sentry.io/1';
    const { initSentry } = await import('./sentry');
    initSentry();
    initSentry();
    expect(mockInit).toHaveBeenCalledTimes(1);
    expect(mockInit).toHaveBeenCalledWith({ dsn: 'https://example.ingest.sentry.io/1', tracesSampleRate: 0 });
  });

  it('captureError is a no-op when Sentry was never initialized', async () => {
    delete process.env.SENTRY_DSN;
    const { initSentry, captureError } = await import('./sentry');
    initSentry();
    captureError(new Error('boom'));
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('captureError forwards to Sentry once initialized', async () => {
    process.env.SENTRY_DSN = 'https://example.ingest.sentry.io/1';
    const { initSentry, captureError } = await import('./sentry');
    initSentry();
    const err = new Error('boom');
    captureError(err);
    expect(mockCaptureException).toHaveBeenCalledWith(err);
  });
});
