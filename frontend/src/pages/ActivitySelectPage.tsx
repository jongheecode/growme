import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, listActivities, createActivity } from '../api/activities';

const CATEGORIES: Activity['category'][] = ['EXERCISE', 'STUDY', 'READING', 'ETC'];

export default function ActivitySelectPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Activity['category']>('ETC');
  const navigate = useNavigate();

  useEffect(() => {
    listActivities().then(setActivities);
  }, []);

  async function handleCreate() {
    const created = await createActivity(name, category);
    setActivities((prev) => [...prev, created]);
    setName('');
  }

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
