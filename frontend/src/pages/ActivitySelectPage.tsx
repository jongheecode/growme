import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, listActivities, createActivity } from '../api/activities';

const CATEGORIES: Activity['category'][] = ['EXERCISE', 'STUDY', 'READING', 'ETC'];

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

  if (error) return <p>{error}</p>;

  return (
    <div>
      <ul>
        {activities.map((a) => (
          <li key={a.id}>
            <button onClick={() => navigate(`/timer/${a.id}`)}>{a.name}</button>
          </li>
        ))}
      </ul>
      <label htmlFor="activity-name">활동 이름</label>
      <input id="activity-name" value={name} onChange={(e) => setName(e.target.value)} />
      <select value={category} onChange={(e) => setCategory(e.target.value as Activity['category'])}>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button onClick={handleCreate}>활동 만들기</button>
    </div>
  );
}
