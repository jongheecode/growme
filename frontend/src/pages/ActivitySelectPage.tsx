import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, listActivities, createActivity } from '../api/activities';
import Layout from '../components/Layout';

const CATEGORIES: Activity['category'][] = ['EXERCISE', 'STUDY', 'READING', 'ETC'];
const CATEGORY_LABEL: Record<Activity['category'], string> = {
  EXERCISE: '운동',
  STUDY: '학업',
  READING: '독서',
  ETC: '기타',
};

export default function ActivitySelectPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Activity['category']>('ETC');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchActivities() {
      try {
        const data = await listActivities();
        setActivities(data);
      } catch {
        setError('활동 목록을 불러오지 못했어요');
      }
    }
    fetchActivities();
  }, []);

  async function handleCreate() {
    try {
      const created = await createActivity(name, category);
      setActivities((prev) => [...prev, created]);
      setName('');
    } catch {
      setError('활동을 만들지 못했어요');
    }
  }

  if (error) {
    return (
      <Layout>
        <p className="text-coral-dark">{error}</p>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-xl font-bold text-coral-dark text-center">어떤 활동을 할까요?</h1>

        <ul className="space-y-2">
          {activities.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => navigate(`/timer/${a.id}`)}
                className="w-full flex items-center justify-between bg-white rounded-card shadow-sm px-5 py-4 hover:shadow-md transition-shadow text-left"
              >
                <span className="font-medium text-ink">{a.name}</span>
                <span className="text-xs font-semibold text-mint-dark bg-mint-light px-2 py-1 rounded-full">
                  {CATEGORY_LABEL[a.category]}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="bg-white rounded-card shadow-sm p-6 space-y-3">
          <p className="text-sm font-semibold text-ink-soft">새로운 활동 추가하기</p>
          <div>
            <label htmlFor="activity-name" className="sr-only">
              활동 이름
            </label>
            <input
              id="activity-name"
              placeholder="예: 알고리즘 스터디"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-cream-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral/40"
            />
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Activity['category'])}
            className="w-full rounded-xl border border-cream-dark px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral/40"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </option>
            ))}
          </select>
          <button
            onClick={handleCreate}
            className="w-full bg-coral hover:bg-coral-dark text-white font-semibold rounded-full py-3 transition-colors"
          >
            활동 만들기
          </button>
        </div>
      </div>
    </Layout>
  );
}
