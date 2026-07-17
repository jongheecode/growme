import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { sendGoalChatMessage, ChatMessage } from '../api/goals';
import { useGoals } from '../context/GoalsContext';

interface Props {
  canCancel: boolean;
  onDone: () => void;
}

export default function OnboardingChatScreen({ canCancel, onDone }: Props) {
  const { refreshGoals } = useGoals();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [goalConfirmed, setGoalConfirmed] = useState<string | null>(null);

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

  if (goalConfirmed) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>목표가 생겼어요:</Text>
        <Text testID="goal-confirmed">{goalConfirmed}</Text>
        <TouchableOpacity
          testID="goal-confirmed-continue"
          onPress={async () => {
            await refreshGoals();
            onDone();
          }}
        >
          <Text>계속하기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {canCancel ? (
        <TouchableOpacity testID="onboarding-cancel" onPress={onDone}>
          <Text>닫기</Text>
        </TouchableOpacity>
      ) : null}
      <ScrollView testID="chat-message-list">
        {messages.map((m, i) => (
          <View key={i}>
            <Text>{m.role === 'user' ? '나' : '꾸미'}</Text>
            <Text testID={`chat-message-${i}`}>{m.content}</Text>
          </View>
        ))}
      </ScrollView>
      {error ? (
        <View>
          <Text testID="chat-error">{error}</Text>
          <TouchableOpacity testID="chat-retry" onPress={handleRetry}>
            <Text>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : null}
      {sending ? <Text testID="chat-sending">꾸미가 생각하고 있어요...</Text> : null}
      <TextInput testID="chat-input" value={input} onChangeText={setInput} placeholder="메시지를 입력하세요" />
      <TouchableOpacity testID="chat-send" onPress={handleSend}>
        <Text>전송</Text>
      </TouchableOpacity>
    </View>
  );
}
