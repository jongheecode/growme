import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { sendGoalChatMessage, createGoal, ChatMessage } from '../api/goals';
import { Category } from '../api/tasks';
import { useGoals } from '../context/GoalsContext';
import KkumiView from '../components/KkumiView';
import { colors, fonts, categoryMeta } from '../theme';

interface Props {
  canCancel: boolean;
  onDone: () => void;
}

const CATEGORIES: Category[] = ['EXERCISE', 'STUDY', 'READING', 'ETC'];

export default function OnboardingChatScreen({ canCancel, onDone }: Props) {
  const { refreshGoals } = useGoals();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [goalConfirmed, setGoalConfirmed] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualCategory, setManualCategory] = useState<Category>('ETC');
  const [manualError, setManualError] = useState('');

  async function sendMessages(nextMessages: ChatMessage[]) {
    setError('');
    setSending(true);
    try {
      const result = await sendGoalChatMessage(nextMessages);
      setMessages([...nextMessages, { role: 'assistant', content: result.reply }]);
      if (result.goalSet && result.goal) {
        setGoalConfirmed(result.goal.title);
      }
    } catch {
      setError('메시지를 보내지 못했어요');
    } finally {
      setSending(false);
    }
  }

  function handleSend() {
    if (input.trim().length === 0 || sending) return;
    const text = input.trim();
    setInput('');
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    sendMessages(nextMessages);
  }

  function handleRetry() {
    sendMessages(messages);
  }

  async function handleManualSubmit() {
    if (manualTitle.trim().length === 0) return;
    setManualError('');
    try {
      const goal = await createGoal(manualTitle.trim(), manualCategory);
      setGoalConfirmed(goal.title);
    } catch {
      setManualError('목표를 만들지 못했어요');
    }
  }

  if (goalConfirmed) {
    return (
      <SafeAreaView
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 }}
      >
        <KkumiView species="SPECIES_A" stage={2} />
        <Text style={{ fontFamily: fonts.body, fontSize: 14, color: colors.inkMuted, marginTop: 14 }}>목표가 생겼어요:</Text>
        <Text testID="goal-confirmed" style={{ fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginTop: 6, marginBottom: 24 }}>
          {goalConfirmed}
        </Text>
        <TouchableOpacity
          testID="goal-confirmed-continue"
          onPress={async () => {
            await refreshGoals();
            onDone();
          }}
          style={{ backgroundColor: colors.green, borderRadius: 16, paddingVertical: 15, paddingHorizontal: 40, alignItems: 'center' }}
        >
          <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 16 }}>계속하기</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <KkumiView species="SPECIES_A" stage={2} size={32} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.heading, fontSize: 16, color: colors.ink }}>꾸미</Text>
          <Text style={{ fontFamily: fonts.body, fontSize: 11, color: colors.green }}>목표를 함께 정해요</Text>
        </View>
        {canCancel ? (
          <TouchableOpacity
            testID="onboarding-cancel"
            onPress={onDone}
            style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: colors.inkMuted, fontSize: 16 }}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
      <ScrollView testID="chat-message-list" style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 10 }}>
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <View key={i} style={{ flexDirection: 'row', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
              <View
                style={{
                  maxWidth: '78%',
                  paddingHorizontal: 15,
                  paddingVertical: 12,
                  borderRadius: 18,
                  backgroundColor: isUser ? colors.green : colors.card,
                  borderWidth: isUser ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <Text testID={`chat-message-${i}`} style={{ fontFamily: fonts.body, fontSize: 14, color: isUser ? '#fff' : colors.ink, lineHeight: 20 }}>
                  {m.content}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {error ? (
        <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
          <Text testID="chat-error" style={{ fontFamily: fonts.body, color: colors.fail, marginBottom: 6 }}>
            {error}
          </Text>
          <TouchableOpacity testID="chat-retry" onPress={handleRetry}>
            <Text style={{ fontFamily: fonts.heading, color: colors.green }}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {sending ? (
        <Text testID="chat-sending" style={{ fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, paddingHorizontal: 16, marginBottom: 6 }}>
          꾸미가 생각하고 있어요...
        </Text>
      ) : null}

      {manualMode ? (
        <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 10 }}>
          <TextInput
            testID="onboarding-manual-title"
            value={manualTitle}
            onChangeText={setManualTitle}
            placeholder="목표 제목 (예: 매일 30분 걷기)"
            placeholderTextColor={colors.inkFaint}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 16,
              backgroundColor: colors.card,
              fontFamily: fonts.body,
              fontSize: 14,
              color: colors.ink,
            }}
          />
          <View testID="onboarding-manual-category-picker" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c}
                testID={`onboarding-manual-category-${c}`}
                onPress={() => setManualCategory(c)}
                style={{
                  paddingHorizontal: 13,
                  paddingVertical: 8,
                  borderRadius: 14,
                  backgroundColor: manualCategory === c ? categoryMeta[c].color : colors.card,
                  borderWidth: manualCategory === c ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                <Text style={{ fontFamily: fonts.heading, fontSize: 12, color: manualCategory === c ? '#fff' : colors.inkMuted }}>
                  {categoryMeta[c].label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {manualError ? (
            <Text testID="onboarding-manual-error" style={{ fontFamily: fonts.body, color: colors.fail, fontSize: 12 }}>
              {manualError}
            </Text>
          ) : null}
          <TouchableOpacity
            testID="onboarding-manual-submit"
            onPress={handleManualSubmit}
            style={{ backgroundColor: colors.green, borderRadius: 16, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 15 }}>이 목표로 시작하기</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="onboarding-manual-cancel" onPress={() => setManualMode(false)} style={{ alignItems: 'center' }}>
            <Text style={{ fontFamily: fonts.body, color: colors.inkMuted, fontSize: 12 }}>다시 대화로 돌아가기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', padding: 14, paddingBottom: 4 }}>
            <TextInput
              testID="chat-input"
              value={input}
              onChangeText={setInput}
              placeholder="메시지를 입력하세요"
              placeholderTextColor={colors.inkFaint}
              style={{
                flex: 1,
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderWidth: 1.5,
                borderColor: colors.border,
                borderRadius: 22,
                backgroundColor: colors.card,
                fontFamily: fonts.body,
                fontSize: 14,
                color: colors.ink,
              }}
            />
            <TouchableOpacity
              testID="chat-send"
              onPress={handleSend}
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#fff', fontSize: 18 }}>↑</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            testID="onboarding-manual-toggle"
            onPress={() => setManualMode(true)}
            style={{ alignItems: 'center', paddingBottom: 12 }}
          >
            <Text style={{ fontFamily: fonts.body, color: colors.inkMuted, fontSize: 12 }}>AI 없이 직접 입력할게요</Text>
          </TouchableOpacity>
        </>
      )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
