import * as Sentry from '@sentry/node';

let initialized = false;

// SENTRY_DSN이 비어있으면(로컬 개발 기본값) 아무것도 하지 않는다 —
// 키 없이도 서버가 평소처럼 뜨고, captureError 호출도 전부 조용히 no-op된다.
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN ?? '';
  if (!dsn || initialized) return;
  Sentry.init({ dsn, tracesSampleRate: 0 });
  initialized = true;
}

export function captureError(err: unknown): void {
  if (!initialized) return;
  Sentry.captureException(err);
}
