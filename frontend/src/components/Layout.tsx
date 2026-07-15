import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }: { children: ReactNode }) {
  const { logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-sm border-b border-cream-dark">
        <Link to="/" className="text-lg font-bold text-coral-dark">
          🌱 그로우미
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium text-ink-soft">
          <Link to="/" className="hover:text-coral-dark transition-colors">
            홈
          </Link>
          <Link to="/history" className="hover:text-coral-dark transition-colors">
            히스토리
          </Link>
          <button onClick={handleLogout} className="hover:text-coral-dark transition-colors">
            로그아웃
          </button>
        </nav>
      </header>
      <main className="flex flex-col items-center px-6 py-10">{children}</main>
    </div>
  );
}
