import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Animated, Easing } from 'react-native';
import { Task, Category, Difficulty, DueChoice } from '../api/tasks';
import { TaskSuggestion } from '../api/goals';

interface Props {
  tasks: Task[];
  onComplete: (id: string) => void;
  onCreate: (title: string, category: Category, difficulty: Difficulty, dueChoice: DueChoice) => void;
  suggestions?: TaskSuggestion[];
  suggestionsLoading?: boolean;
  onRequestSuggestions?: () => void;
  onAcceptSuggestion?: (suggestion: TaskSuggestion) => void;
  onRejectSuggestion?: (index: number) => void;
}

const CATEGORIES: Category[] = ['EXERCISE', 'STUDY', 'READING', 'ETC'];
const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

export default function TaskSheet({
  tasks,
  onComplete,
  onCreate,
  suggestions = [],
  suggestionsLoading = false,
  onRequestSuggestions = () => {},
  onAcceptSuggestion = () => {},
  onRejectSuggestion = () => {},
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<Category>('ETC');
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [dueChoice, setDueChoice] = useState<DueChoice>('TODAY');
  const progress = useRef(new Animated.Value(0)).current;

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'COMPLETED').length;

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    Animated.timing(progress, {
      toValue: next ? 1 : 0,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }

  function handleCreate() {
    if (title.trim().length === 0) return;
    onCreate(title.trim(), category, difficulty, dueChoice);
    setTitle('');
  }

  const size = progress.interpolate({ inputRange: [0, 1], outputRange: [64, 320] });

  return (
    <Animated.View
      testID="task-sheet-container"
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: size,
        height: size,
        borderRadius: 16,
        backgroundColor: '#fff',
        overflow: 'hidden',
      }}
    >
      {!expanded ? (
        <TouchableOpacity testID="task-fab" onPress={toggle} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text testID="task-fab-count">{`${done}/${total}`}</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1, padding: 12 }}>
          <TouchableOpacity testID="task-sheet-close" onPress={toggle}>
            <Text>닫기</Text>
          </TouchableOpacity>
          <ScrollView testID="task-list">
            {tasks.map((t) => (
              <View key={t.id}>
                <Text>{`${t.title} (+${t.xpValue}XP)`}</Text>
                {t.status === 'PENDING' ? (
                  <TouchableOpacity testID={`task-complete-${t.id}`} onPress={() => onComplete(t.id)}>
                    <Text>완료</Text>
                  </TouchableOpacity>
                ) : (
                  <Text testID={`task-status-${t.id}`}>{t.status === 'COMPLETED' ? '완료됨' : '실패'}</Text>
                )}
              </View>
            ))}
          </ScrollView>
          <TextInput testID="new-task-title" placeholder="할일 제목" value={title} onChangeText={setTitle} />
          <View testID="category-picker">
            {CATEGORIES.map((c) => (
              <TouchableOpacity key={c} testID={`category-${c}`} onPress={() => setCategory(c)}>
                <Text>{c}{category === c ? ' ✓' : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View testID="difficulty-picker">
            {DIFFICULTIES.map((d) => (
              <TouchableOpacity key={d} testID={`difficulty-${d}`} onPress={() => setDifficulty(d)}>
                <Text>{d}{difficulty === d ? ' ✓' : ''}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View testID="due-choice-picker">
            <TouchableOpacity testID="due-today" onPress={() => setDueChoice('TODAY')}>
              <Text>오늘{dueChoice === 'TODAY' ? ' ✓' : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="due-week" onPress={() => setDueChoice('THIS_WEEK')}>
              <Text>이번 주{dueChoice === 'THIS_WEEK' ? ' ✓' : ''}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity testID="request-suggestions" onPress={onRequestSuggestions} disabled={suggestionsLoading}>
            <Text>{suggestionsLoading ? '추천받는 중...' : '추천받기'}</Text>
          </TouchableOpacity>
          {suggestions.map((s, i) => (
            <View key={i} testID={`suggestion-card-${i}`}>
              <Text>{`${s.title} (${s.difficulty})`}</Text>
              <TouchableOpacity testID={`suggestion-accept-${i}`} onPress={() => onAcceptSuggestion(s)}>
                <Text>수락</Text>
              </TouchableOpacity>
              <TouchableOpacity testID={`suggestion-reject-${i}`} onPress={() => onRejectSuggestion(i)}>
                <Text>거절</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity testID="add-task-submit" onPress={handleCreate}>
            <Text>추가</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}
