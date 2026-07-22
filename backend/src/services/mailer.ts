// 아직 실제 이메일 발송 서비스(Resend/SendGrid 등)를 붙이지 않아서
// 링크를 콘솔에 로그로만 남긴다. 나중에 발송 서비스를 붙일 때
// 이 함수 내부만 교체하면 되도록 forgot-password 라우트와 분리해뒀다.
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  console.log(`[mailer] password reset link for ${email}: ${resetLink}`);
}
