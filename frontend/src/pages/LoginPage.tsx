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
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">이메일</label>
      <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <label htmlFor="password">비밀번호</label>
      <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">로그인</button>
      {error && <p>{error}</p>}
    </form>
  );
}
