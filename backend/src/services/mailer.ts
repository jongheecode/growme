import axios from 'axios';

// RESEND_API_KEY가 비어있으면(로컬 개발 기본값) 기존처럼 콘솔 로그로만
// 남긴다 — 키를 안 받은 사람도 이 파일을 안 건드리고 그대로 개발할 수 있게.
// 키가 있는데 발송 자체가 실패하면(네트워크 오류 등) 비밀번호 재설정이
// 완전히 막히지 않도록 콘솔 로그 폴백으로 링크를 남긴다.
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY ?? '';
  if (!apiKey) {
    console.log(`[mailer] password reset link for ${email}: ${resetLink}`);
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL || 'GrowMe <onboarding@resend.dev>';
  try {
    await axios.post(
      'https://api.resend.com/emails',
      {
        from,
        to: email,
        subject: '[GrowMe] 비밀번호 재설정',
        html: `<p>아래 링크를 눌러 비밀번호를 재설정해주세요.</p><p><a href="${resetLink}">${resetLink}</a></p><p>본인이 요청하지 않았다면 이 메일을 무시해도 괜찮아요.</p>`,
      },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
  } catch (err) {
    console.error('[mailer] failed to send password reset email via Resend', err);
    console.log(`[mailer] password reset link for ${email}: ${resetLink}`);
  }
}
