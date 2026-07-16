import { useEffect, useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, getMe, updateMe, changePassword, deleteMe } from '../api/users';
import { GrowthState, getMyGrowth } from '../api/growth';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [growth, setGrowth] = useState<GrowthState | null>(null);
  const [error, setError] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [bioSaved, setBioSaved] = useState(false);
  const [bioSaveError, setBioSaveError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [p, g] = await Promise.all([getMe(), getMyGrowth()]);
        setProfile(p);
        setGrowth(g);
        setBioDraft(p.bio ?? '');
      } catch {
        setError('프로필을 불러오지 못했어요');
      }
    }
    load();
  }, []);

  async function handleSaveBio(e: FormEvent) {
    e.preventDefault();
    setBioSaved(false);
    setBioSaveError('');
    try {
      const updated = await updateMe({ bio: bioDraft });
      setProfile(updated);
      setBioSaved(true);
    } catch {
      setBioSaveError('한줄소개를 저장하지 못했어요');
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMessage('비밀번호를 변경했어요');
      setCurrentPassword('');
      setNewPassword('');
    } catch {
      setPasswordError('비밀번호 변경에 실패했어요');
    }
  }

  async function handleDelete() {
    setDeleteError('');
    try {
      await deleteMe();
      logout();
      navigate('/login');
    } catch {
      setDeleteError('회원탈퇴에 실패했어요');
    }
  }

  if (error) {
    return (
      <Layout>
        <p className="text-coral-dark">{error}</p>
      </Layout>
    );
  }
  if (!profile || !growth) {
    return (
      <Layout>
        <p className="text-ink-soft">불러오는 중...</p>
      </Layout>
    );
  }

  const joinedLabel = profile.createdAt.slice(0, 10).replace(/-/g, '.') + ' 가입';
  const accumulatedHours = Math.floor(growth.currentGauge / 3600);

  return (
    <Layout>
      <div className="w-full max-w-lg space-y-6">
        <div className="bg-white rounded-card shadow-sm p-8 text-center space-y-2">
          <p className="text-xl font-display text-coral-dark">{profile.nickname}</p>
          <p className="text-sm text-ink-soft">{profile.email}</p>
          <p className="text-xs text-ink-soft">{joinedLabel}</p>
          <p className="text-sm text-ink pt-2">
            누적 {accumulatedHours}h · {growth.stage}단계
          </p>
        </div>

        <form onSubmit={handleSaveBio} className="bg-white rounded-card shadow-sm p-6 space-y-3">
          <label htmlFor="bio" className="block text-sm font-semibold text-ink-soft">
            한줄소개
          </label>
          <input
            id="bio"
            value={bioDraft}
            maxLength={60}
            onChange={(e) => setBioDraft(e.target.value)}
            placeholder="한줄소개를 남겨보세요"
            className="w-full rounded-xl border border-cream-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral/40"
          />
          <button
            type="submit"
            className="bg-coral hover:bg-coral-dark text-white font-display rounded-full px-6 py-2 transition-colors"
          >
            저장
          </button>
          {bioSaved && <p className="text-sm text-mint-dark">저장했어요</p>}
          {bioSaveError && <p className="text-sm text-coral-dark">{bioSaveError}</p>}
        </form>

        <div className="bg-white rounded-card shadow-sm p-6">
          <p className="text-sm font-semibold text-ink-soft mb-2">훈장</p>
          <p className="text-sm text-ink-soft">아직 획득한 훈장이 없어요</p>
        </div>

        <form onSubmit={handleChangePassword} className="bg-white rounded-card shadow-sm p-6 space-y-3">
          <p className="text-sm font-semibold text-ink-soft">비밀번호</p>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="현재 비밀번호"
            aria-label="현재 비밀번호"
            className="w-full rounded-xl border border-cream-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral/40"
          />
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호"
            aria-label="새 비밀번호"
            className="w-full rounded-xl border border-cream-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral/40"
          />
          <button
            type="submit"
            className="bg-coral hover:bg-coral-dark text-white font-display rounded-full px-6 py-2 transition-colors"
          >
            비밀번호 변경
          </button>
          {passwordMessage && <p className="text-sm text-mint-dark">{passwordMessage}</p>}
          {passwordError && <p className="text-sm text-coral-dark">{passwordError}</p>}
        </form>

        <div className="bg-white rounded-card shadow-sm p-6 space-y-3">
          <p className="text-sm font-semibold text-coral-dark">회원탈퇴</p>
          {!confirmingDelete ? (
            <button onClick={() => setConfirmingDelete(true)} className="text-sm text-coral-dark underline">
              계정을 삭제할래요
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-ink-soft">정말 탈퇴하시겠어요? 모든 기록이 삭제됩니다.</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="bg-coral-dark text-white text-sm font-display rounded-full px-4 py-2"
                >
                  탈퇴할게요
                </button>
                <button onClick={() => setConfirmingDelete(false)} className="text-sm text-ink-soft">
                  취소
                </button>
              </div>
              {deleteError && <p className="text-sm text-coral-dark">{deleteError}</p>}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
