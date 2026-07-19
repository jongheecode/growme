import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Task, Category, Difficulty, DueChoice, listTasks, createTask, completeTask, ackReaction } from '../api/tasks';
import { GrowthState, getGrowth } from '../api/growth';
import { TaskSuggestion, suggestTasks } from '../api/goals';
import { useGoals } from '../context/GoalsContext';
import KkumiView from '../components/KkumiView';
import KkumiInfoModal from '../components/KkumiInfoModal';
import ReactionModal from '../components/ReactionModal';
import TaskSheet from '../components/TaskSheet';

export default function HomeScreen() {
  const { goals, activeGoalId, setActiveGoalId } = useGoals();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [growth, setGrowth] = useState<GrowthState | null>(null);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [reactionQueue, setReactionQueue] = useState<Task[]>([]);
  const [immediateReaction, setImmediateReaction] = useState<{ text: string; outcome: 'COMPLETED' | 'FAILED' } | null>(null);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError('');
      const [taskList, growthState] = await Promise.all([listTasks(), getGrowth()]);
      setTasks(taskList);
      setGrowth(growthState);
      setReactionQueue((current) =>
        current.length > 0 ? current : taskList.filter((t) => t.reactionText && !t.reactionShownAt)
      );
    } catch {
      setError('불러오지 못했어요');
    } finally {
      setTasksLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleRequestSuggestions = useCallback(async () => {
    if (!activeGoalId) return;
    setSuggestionsLoading(true);
    try {
      const result = await suggestTasks(activeGoalId);
      setSuggestions(result);
    } catch {
      setError('지금은 추천을 가져올 수 없어요, 다시 시도해주세요');
    } finally {
      setSuggestionsLoading(false);
    }
  }, [activeGoalId]);

  useEffect(() => {
    if (!tasksLoaded || !activeGoalId) return;
    const hasTasksForGoal = tasks.some((t) => t.goalId === activeGoalId);
    if (!hasTasksForGoal && suggestions.length === 0 && !suggestionsLoading) {
      handleRequestSuggestions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGoalId, tasksLoaded]);

  async function handleComplete(id: string) {
    let failureMessage = '';
    try {
      const completed = await completeTask(id);
      if (completed.reactionText) {
        setImmediateReaction({ text: completed.reactionText, outcome: 'COMPLETED' });
      }
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
      await createTask(title, category, difficulty, dueChoice, activeGoalId ?? undefined);
      await refresh();
    } catch {
      setError('할일을 추가하지 못했어요');
    }
  }

  async function handleAcceptSuggestion(s: TaskSuggestion) {
    setSuggestions((current) => current.filter((x) => x !== s));
    try {
      await createTask(s.title, s.category, s.difficulty, s.dueChoice, activeGoalId ?? undefined);
      await refresh();
    } catch {
      setError('할일을 추가하지 못했어요');
    }
  }

  function handleRejectSuggestion(index: number) {
    setSuggestions((current) => current.filter((_, i) => i !== index));
  }

  async function handleDismissQueuedReaction() {
    const [current, ...rest] = reactionQueue;
    if (!current) return;
    setReactionQueue(rest);
    try {
      await ackReaction(current.id);
    } catch {
      // best-effort — ack 실패 시 다음 refresh에서 다시 큐에 나타날 수 있다.
    }
  }

  const visibleTasks = tasks.filter((t) => t.goalId === activeGoalId);
  const queuedReaction = reactionQueue[0];
  const activeReaction =
    immediateReaction ?? (queuedReaction ? { text: queuedReaction.reactionText!, outcome: 'FAILED' as const } : null);

  return (
    <View style={{ flex: 1, backgroundColor: '#EAF4EF' }}>
      <ScrollView horizontal testID="goal-chip-list" style={{ maxHeight: 48, flexGrow: 0 }}>
        {goals.map((g) => (
          <TouchableOpacity
            key={g.id}
            testID={`goal-chip-${g.id}`}
            onPress={() => setActiveGoalId(g.id)}
            style={{ padding: 8, opacity: g.id === activeGoalId ? 1 : 0.5 }}
          >
            <Text>{g.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
      {activeReaction ? (
        <ReactionModal
          visible
          text={activeReaction.text}
          outcome={activeReaction.outcome}
          onDismiss={immediateReaction ? () => setImmediateReaction(null) : handleDismissQueuedReaction}
        />
      ) : null}
      <TaskSheet
        tasks={visibleTasks}
        onComplete={handleComplete}
        onCreate={handleCreate}
        suggestions={suggestions}
        suggestionsLoading={suggestionsLoading}
        onRequestSuggestions={handleRequestSuggestions}
        onAcceptSuggestion={handleAcceptSuggestion}
        onRejectSuggestion={handleRejectSuggestion}
      />
    </View>
  );
}
