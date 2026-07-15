import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as loginApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const { token } = await loginApi(email, password);
      login(token);
      navigate('/');
    } catch {
      setError('로그인에 실패했어요');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white rounded-card shadow-sm p-8 space-y-4">
        <div className="text-center mb-2">
          <p className="text-4xl">🌱</p>
          <h1 className="text-2xl font-bold text-coral-dark mt-2">그로우미</h1>
          <p className="text-sm text-ink-soft mt-1">몰입한 시간만큼, 꾸미가 자라요</p>
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
          className="w-full bg-coral hover:bg-coral-dark text-white font-semibold rounded-full py-3 transition-colors"
        >
          로그인
        </button>
        {error && <p className="text-sm text-coral-dark text-center">{error}</p>}
      </form>
    </div>
  );
}
