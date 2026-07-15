import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signup as signupApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { KkumiCharacter } from '../components/KkumiCharacter';

export default function SignupPage() {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const { token } = await signupApi(email, password, nickname);
      login(token);
      navigate('/');
    } catch {
      setError('회원가입에 실패했어요');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-6 relative overflow-hidden">
      <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-mint-light opacity-60" />
      <div className="absolute -bottom-14 -right-14 w-56 h-56 rounded-full bg-honey/30" />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm bg-white rounded-card shadow-sm p-8 space-y-4"
      >
        <div className="text-center mb-2">
          <div className="w-20 h-20 mx-auto">
            <KkumiCharacter stage={0} category="ETC" />
          </div>
          <h1 className="text-2xl font-display text-coral-dark mt-2">그로우미 시작하기</h1>
          <p className="text-sm text-ink-soft mt-1">몰입한 시간만큼, 꾸미가 자라요</p>
        </div>
        <div>
          <label htmlFor="nickname" className="block text-sm font-medium text-ink-soft mb-1">
            닉네임
          </label>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="w-full rounded-xl border border-cream-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral/40"
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-ink-soft mb-1">
            이메일
          </label>
          <input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-cream-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral/40"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-ink-soft mb-1">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-cream-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral/40"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-coral hover:bg-coral-dark text-white font-display text-lg rounded-full py-3 transition-colors"
        >
          회원가입
        </button>
        {error && <p className="text-sm text-coral-dark text-center">{error}</p>}
        <p className="text-sm text-ink-soft text-center">
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="text-coral-dark font-medium hover:underline">
            로그인
          </Link>
        </p>
      </form>
    </div>
  );
}
