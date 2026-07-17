import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Task, Category, Difficulty, DueChoice, listTasks, createTask, completeTask } from '../api/tasks';
import { GrowthState, getGrowth } from '../api/growth';
import KkumiView from '../components/KkumiView';
import KkumiInfoModal from '../components/KkumiInfoModal';
import TaskSheet from '../components/TaskSheet';

export default function HomeScreen() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [growth, setGrowth] = useState<GrowthState | null>(null);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError('');
      const [taskList, growthState] = await Promise.all([listTasks(), getGrowth()]);
      setTasks(taskList);
      setGrowth(growthState);
    } catch {
      setError('불러오지 못했어요');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleComplete(id: string) {
    let failureMessage = '';
    try {
      await completeTask(id);
    } catch (err) {
      failureMessage = err instanceof Error ? err.message : '할일을 완료하지 못했어요';
    }
    // refresh() runs regardless of outcome so an expired task's auto-fail (flipped
    // server-side on the next GET /api/tasks) shows up immediately; refresh() clears
    // any stale error internally, so a failure message here must be set *after* it
    // returns or it would be wiped before ever rendering.
    await refresh();
    if (failureMessage) setError(failureMessage);
  }

  async function handleCreate(title: string, category: Category, difficulty: Difficulty, dueChoice: DueChoice) {
    try {
      await createTask(title, category, difficulty, dueChoice);
      await refresh();
    } catch {
      setError('할일을 추가하지 못했어요');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#EAF4EF' }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {error ? <Text testID="home-error">{error}</Text> : null}
        {growth ? (
          <TouchableOpacity testID="kkumi-tap-target" onPress={() => setModalVisible(true)}>
            <KkumiView species={growth.species} stage={growth.stage} />
          </TouchableOpacity>
        ) : error ? (
          <TouchableOpacity testID="home-retry" onPress={() => refresh()}>
            <Text>다시 시도</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {growth ? (
        <KkumiInfoModal visible={modalVisible} onClose={() => setModalVisible(false)} growth={growth} />
      ) : null}
      <TaskSheet tasks={tasks} onComplete={handleComplete} onCreate={handleCreate} />
    </View>
  );
}
