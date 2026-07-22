import rateLimit from 'express-rate-limit';

// 로그인/회원가입/비밀번호 재설정은 브루트포스, 계정 생성 스팸, 이메일
// 존재 여부 무차별 조회의 표적이 되기 쉬워서 일반 API보다 훨씬 좁은
// 한도를 둔다.
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '요청이 너무 많아요. 잠시 후 다시 시도해주세요' },
  // 테스트는 같은 express 앱 인스턴스로 짧은 시간에 수십 건씩 요청을
  // 보내서 실제 한도에 걸리므로, 테스트 환경에서는 끈다.
  skip: () => process.env.NODE_ENV === 'test',
});
