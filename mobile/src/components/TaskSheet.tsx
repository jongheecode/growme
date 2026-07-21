import { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Animated, Easing } from 'react-native';
import { Task, Category, Difficulty, DueChoice } from '../api/tasks';
import { TaskSuggestion } from '../api/goals';
import { colors, fonts, categoryMeta, difficultyLabel } from '../theme';

interface Props {
  tasks: Task[];
  onComplete: (id: string) => void;
  onCreate: (title: string, category: Category, difficulty: Difficulty, dueChoice: DueChoice) => void;
  suggestions?: TaskSuggestion[];
  suggestionsLoading?: boolean;
  onRequestSuggestions?: () => void;
  onAcceptSuggestion?: (suggestion: TaskSuggestion) => void;
  onRejectSuggestion?: (index: number) => void;
  onOpenTask?: (task: Task) => void;
}

const CATEGORIES: Category[] = ['EXERCISE', 'STUDY', 'READING', 'ETC'];
const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD'];

function pillStyle(active: boolean, color: string = colors.ink) {
  return {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: active ? color : colors.card,
    borderWidth: active ? 0 : 1,
    borderColor: colors.border,
  };
}

export default function TaskSheet({
  tasks,
  onComplete,
  onCreate,
  suggestions = [],
  suggestionsLoading = false,
  onRequestSuggestions = () => {},
  onAcceptSuggestion = () => {},
  onRejectSuggestion = () => {},
  onOpenTask = () => {},
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

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: [64, 340] });
  const height = progress.interpolate({ inputRange: [0, 1], outputRange: [64, 480] });

  return (
    <Animated.View
      testID="task-sheet-container"
      style={{
        position: 'absolute',
        bottom: 24,
        right: 20,
        width,
        height,
        borderRadius: 24,
        backgroundColor: colors.background,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        shadowColor: colors.ink,
        shadowOpacity: 0.15,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
      }}
    >
      {!expanded ? (
        <TouchableOpacity
          testID="task-fab"
          onPress={toggle}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.green, borderRadius: 32 }}
        >
          <Text testID="task-fab-count" style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 18 }}>{`${done}/${total}`}</Text>
          <Text style={{ fontFamily: fonts.body, color: 'rgba(255,255,255,.9)', fontSize: 9, letterSpacing: 1 }}>오늘</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ flex: 1, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <Text style={{ fontFamily: fonts.heading, fontSize: 19, color: colors.ink }}>오늘의 미션</Text>
            <TouchableOpacity testID="task-sheet-close" onPress={toggle}>
              <Text style={{ fontFamily: fonts.body, color: colors.inkMuted, fontSize: 13 }}>닫기</Text>
            </TouchableOpacity>
          </View>
          <ScrollView testID="task-list" style={{ flex: 1 }}>
            <View style={{ gap: 8, paddingBottom: 8 }}>
              {tasks.map((t) => {
                const cat = categoryMeta[t.category];
                return (
                  <TouchableOpacity
                    key={t.id}
                    testID={`task-row-${t.id}`}
                    onPress={() => onOpenTask(t)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 16,
                      backgroundColor: t.status === 'COMPLETED' ? colors.border : colors.card,
                      opacity: t.status === 'COMPLETED' ? 0.75 : 1,
                    }}
                  >
                    {t.status === 'PENDING' ? (
                      <TouchableOpacity
                        testID={`task-complete-${t.id}`}
                        onPress={() => onComplete(t.id)}
                        style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          backgroundColor: t.status === 'COMPLETED' ? colors.green : colors.fail,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text testID={`task-status-${t.id}`} style={{ color: '#fff', fontSize: 12 }}>
                          {t.status === 'COMPLETED' ? '✓' : '✕'}
                        </Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: fonts.heading,
                          fontSize: 15,
                          color: colors.ink,
                          textDecorationLine: t.status === 'COMPLETED' ? 'line-through' : 'none',
                        }}
                      >
                        {t.title}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 3, alignItems: 'center' }}>
                        <View style={{ backgroundColor: `${cat.color}22`, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 1 }}>
                          <Text style={{ fontFamily: fonts.heading, fontSize: 10, color: cat.color }}>{cat.label}</Text>
                        </View>
                        <Text style={{ fontFamily: fonts.body, fontSize: 10, color: colors.inkMuted }}>{difficultyLabel[t.difficulty]}</Text>
                      </View>
                    </View>
                    <Text style={{ fontFamily: fonts.heading, fontSize: 13, color: colors.goldText, backgroundColor: colors.goldTint, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 }}>
                      {`+${t.xpValue}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              testID="new-task-title"
              placeholder="할일 제목"
              placeholderTextColor={colors.inkFaint}
              value={title}
              onChangeText={setTitle}
              style={{
                fontFamily: fonts.body,
                fontSize: 14,
                color: colors.ink,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 14,
                padding: 12,
                marginTop: 10,
                backgroundColor: colors.card,
              }}
            />
            <View testID="category-picker" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity key={c} testID={`category-${c}`} onPress={() => setCategory(c)} style={pillStyle(category === c, categoryMeta[c].color)}>
                  <Text style={{ fontFamily: fonts.heading, fontSize: 12, color: category === c ? '#fff' : colors.inkMuted }}>
                    {categoryMeta[c].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View testID="difficulty-picker" style={{ flexDirection: 'row', gap: 6, marginTop: 6 }}>
              {DIFFICULTIES.map((d) => (
                <TouchableOpacity key={d} testID={`difficulty-${d}`} onPress={() => setDifficulty(d)} style={pillStyle(difficulty === d, colors.ink)}>
                  <Text style={{ fontFamily: fonts.heading, fontSize: 12, color: difficulty === d ? '#fff' : colors.inkMuted }}>
                    {difficultyLabel[d]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View testID="due-choice-picker" style={{ flexDirection: 'row', gap: 6, marginTop: 6, marginBottom: 10 }}>
              <TouchableOpacity testID="due-today" onPress={() => setDueChoice('TODAY')} style={pillStyle(dueChoice === 'TODAY', colors.green)}>
                <Text style={{ fontFamily: fonts.heading, fontSize: 12, color: dueChoice === 'TODAY' ? '#fff' : colors.inkMuted }}>오늘</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="due-week" onPress={() => setDueChoice('THIS_WEEK')} style={pillStyle(dueChoice === 'THIS_WEEK', colors.green)}>
                <Text style={{ fontFamily: fonts.heading, fontSize: 12, color: dueChoice === 'THIS_WEEK' ? '#fff' : colors.inkMuted }}>이번 주</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              testID="request-suggestions"
              onPress={onRequestSuggestions}
              disabled={suggestionsLoading}
              style={{ borderWidth: 1.5, borderColor: colors.green, borderRadius: 14, paddingVertical: 10, alignItems: 'center', marginBottom: 8 }}
            >
              <Text style={{ fontFamily: fonts.heading, color: colors.greenDark, fontSize: 13 }}>
                {suggestionsLoading ? '추천받는 중...' : '추천받기'}
              </Text>
            </TouchableOpacity>
            {suggestions.map((s, i) => (
              <View
                key={i}
                testID={`suggestion-card-${i}`}
                style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 10, marginBottom: 6 }}
              >
                <Text style={{ fontFamily: fonts.heading, fontSize: 13, color: colors.ink }}>{`${s.title} (${s.difficulty})`}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <TouchableOpacity testID={`suggestion-accept-${i}`} onPress={() => onAcceptSuggestion(s)}>
                    <Text style={{ fontFamily: fonts.heading, color: colors.green, fontSize: 12 }}>수락</Text>
                  </TouchableOpacity>
                  <TouchableOpacity testID={`suggestion-reject-${i}`} onPress={() => onRejectSuggestion(i)}>
                    <Text style={{ fontFamily: fonts.heading, color: colors.inkFaint, fontSize: 12 }}>거절</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <TouchableOpacity
              testID="add-task-submit"
              onPress={handleCreate}
              style={{ backgroundColor: colors.green, borderRadius: 14, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 14 }}>추가</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      )}
    </Animated.View>
  );
}
