import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Task, Category, Difficulty, DueChoice, listTasks, createTask, completeTask, ackReaction } from '../api/tasks';
import { GrowthState, Species, getGrowth } from '../api/growth';
import { EquippedAccessory, getMyAccessories } from '../api/shop';
import { TaskSuggestion, suggestTasks } from '../api/goals';
import { useGoals } from '../context/GoalsContext';
import KkumiView from '../components/KkumiView';
import KkumiInfoModal from '../components/KkumiInfoModal';
import ReactionModal from '../components/ReactionModal';
import MissionModal from '../components/MissionModal';
import TaskSheet from '../components/TaskSheet';
import { colors, fonts } from '../theme';

interface ReactionInfo {
  text: string;
  outcome: 'COMPLETED' | 'FAILED';
  xp?: number;
  points?: number;
  species?: Species | null;
  stage?: number;
  hatch?: boolean;
}

export default function HomeScreen() {
  const { goals, activeGoalId, setActiveGoalId } = useGoals();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoaded, setTasksLoaded] = useState(false);
  const [growth, setGrowth] = useState<GrowthState | null>(null);
  const [error, setError] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [reactionQueue, setReactionQueue] = useState<Task[]>([]);
  const [immediateReaction, setImmediateReaction] = useState<ReactionInfo | null>(null);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [accessories, setAccessories] = useState<EquippedAccessory[]>([]);

  const refresh = useCallback(async () => {
    try {
      setError('');
      const [taskList, growthState, accessoryList] = await Promise.all([
        listTasks(),
        getGrowth(),
        getMyAccessories(),
      ]);
      setTasks(taskList);
      setGrowth(growthState);
      setAccessories(accessoryList);
      setReactionQueue((current) =>
        current.length > 0 ? current : taskList.filter((t) => t.reactionText && !t.reactionShownAt)
      );
      return growthState;
    } catch {
      setError('불러오지 못했어요');
      return null;
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
    const prevGrowth = growth;
    let reactionText: string | null = null;
    let xpValue = 0;
    try {
      const completed = await completeTask(id);
      reactionText = completed.reactionText;
      xpValue = completed.xpValue;
    } catch (err) {
      failureMessage = err instanceof Error ? err.message : '할일을 완료하지 못했어요';
    }
    // refresh() runs regardless of outcome so an expired task's auto-fail (flipped
    // server-side on the next GET /api/tasks) shows up immediately; refresh() clears
    // any stale error internally, so a failure message here must be set *after* it
    // returns or it would be wiped before ever rendering. Its return value (rather
    // than the `growth` state var, which wouldn't be updated yet in this closure) is
    // what lets us detect a just-now hatch for the reaction modal.
    const newGrowth = await refresh();
    if (reactionText) {
      const hatch = !!(prevGrowth && !prevGrowth.species && newGrowth?.species);
      setImmediateReaction({
        text: reactionText,
        outcome: 'COMPLETED',
        xp: xpValue,
        points: xpValue,
        species: newGrowth?.species ?? null,
        stage: newGrowth?.stage ?? 0,
        hatch,
      });
    }
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
  const activeReaction: ReactionInfo | null =
    immediateReaction ?? (queuedReaction ? { text: queuedReaction.reactionText!, outcome: 'FAILED' } : null);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView horizontal testID="goal-chip-list" style={{ maxHeight: 48, flexGrow: 0 }}>
        {goals.map((g) => (
          <TouchableOpacity
            key={g.id}
            testID={`goal-chip-${g.id}`}
            onPress={() => setActiveGoalId(g.id)}
            style={{
              padding: 8,
              opacity: g.id === activeGoalId ? 1 : 0.5,
            }}
          >
            <Text style={{ fontFamily: fonts.heading, color: colors.ink }}>{g.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {error ? (
          <Text testID="home-error" style={{ fontFamily: fonts.body, color: colors.fail }}>
            {error}
          </Text>
        ) : null}
        {growth ? (
          <>
            <View
              testID="points-badge"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                backgroundColor: colors.goldTint,
                paddingHorizontal: 11,
                paddingVertical: 3,
                borderRadius: 14,
                marginBottom: 10,
              }}
            >
              <Text style={{ fontFamily: fonts.heading, fontSize: 13, color: colors.goldText }}>{`${growth.points} P`}</Text>
            </View>
            <TouchableOpacity testID="kkumi-tap-target" onPress={() => setModalVisible(true)}>
              <KkumiView species={growth.species} stage={growth.stage} accessories={accessories} />
            </TouchableOpacity>
          </>
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
          xp={activeReaction.xp}
          points={activeReaction.points}
          species={activeReaction.species}
          stage={activeReaction.stage}
          hatch={activeReaction.hatch}
          onDismiss={immediateReaction ? () => setImmediateReaction(null) : handleDismissQueuedReaction}
        />
      ) : null}
      <MissionModal
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onComplete={(id) => {
          setSelectedTask(null);
          handleComplete(id);
        }}
      />
      <TaskSheet
        tasks={visibleTasks}
        onComplete={handleComplete}
        onCreate={handleCreate}
        suggestions={suggestions}
        suggestionsLoading={suggestionsLoading}
        onRequestSuggestions={handleRequestSuggestions}
        onAcceptSuggestion={handleAcceptSuggestion}
        onRejectSuggestion={handleRejectSuggestion}
        onOpenTask={(t) => setSelectedTask(t)}
      />
    </View>
  );
}
