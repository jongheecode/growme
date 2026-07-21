import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Task } from '../api/tasks';
import { startTaskSession, sendHeartbeat, endSession } from '../api/sessions';
import { colors, fonts, categoryMeta, difficultyLabel } from '../theme';

const HEARTBEAT_INTERVAL_MS = 30_000;

interface Props {
  task: Task | null;
  onClose: () => void;
  onComplete: (id: string) => void;
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const s = Math.floor(totalSeconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function MissionModal({ task, onClose, onComplete }: Props) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const sessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = null;
    setSessionId(null);
    setElapsedSeconds(0);
  }, [task?.id]);

  useEffect(() => {
    if (!sessionId) return;
    const tickId = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    const heartbeatId = setInterval(() => {
      sendHeartbeat(sessionId).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(tickId);
      clearInterval(heartbeatId);
    };
  }, [sessionId]);

  if (!task) return null;

  async function stopTimerIfRunning() {
    const current = sessionIdRef.current;
    if (!current) return;
    sessionIdRef.current = null;
    setSessionId(null);
    try {
      await endSession(current);
    } catch {
      // best-effort — 실패해도 staleSessionJob이 결국 정리한다.
    }
  }

  async function handleStartTimer() {
    try {
      const session = await startTaskSession(task!.id);
      sessionIdRef.current = session.id;
      setSessionId(session.id);
      setElapsedSeconds(0);
    } catch {
      // 시작 실패 시 조용히 무시 — 버튼이 다시 눌릴 수 있는 상태로 남는다.
    }
  }

  async function handleComplete() {
    await stopTimerIfRunning();
    onComplete(task!.id);
  }

  async function handleClose() {
    await stopTimerIfRunning();
    onClose();
  }

  const cat = categoryMeta[task.category];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      <View testID="mission-modal" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(42,38,34,.4)' }}>
        <View style={{ backgroundColor: colors.background, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 36 }}>
          <View testID="mission-meta" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <View style={{ backgroundColor: `${cat.color}22`, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 }}>
              <Text style={{ fontFamily: fonts.heading, fontSize: 11, color: cat.color }}>{cat.label}</Text>
            </View>
            <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted }}>{difficultyLabel[task.difficulty]}</Text>
            <View style={{ marginLeft: 'auto', backgroundColor: colors.goldTint, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 }}>
              <Text style={{ fontFamily: fonts.heading, color: colors.goldText }}>{`+${task.xpValue} XP`}</Text>
            </View>
          </View>

          <Text testID="mission-title" style={{ fontFamily: fonts.heading, fontSize: 26, color: colors.ink, marginBottom: 20 }}>
            {task.title}
          </Text>

          {task.status === 'PENDING' ? (
            <>
              <View style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 24, alignItems: 'center', marginBottom: 14 }}>
                <Text style={{ fontFamily: fonts.body, fontSize: 12, color: colors.inkMuted, marginBottom: 6 }}>집중 타이머 (선택)</Text>
                <Text testID="mission-timer" style={{ fontFamily: fonts.heading, fontSize: 48, color: colors.ink }}>
                  {formatElapsed(elapsedSeconds)}
                </Text>
                {sessionId ? (
                  <TouchableOpacity
                    testID="mission-timer-stop"
                    onPress={stopTimerIfRunning}
                    style={{ marginTop: 14, paddingHorizontal: 26, paddingVertical: 10, borderRadius: 24, backgroundColor: colors.border }}
                  >
                    <Text style={{ fontFamily: fonts.heading, color: colors.inkMuted }}>멈추기</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    testID="mission-timer-start"
                    onPress={handleStartTimer}
                    style={{ marginTop: 14, paddingHorizontal: 26, paddingVertical: 10, borderRadius: 24, backgroundColor: colors.green }}
                  >
                    <Text style={{ fontFamily: fonts.heading, color: '#fff' }}>타이머 시작</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  testID="mission-close"
                  onPress={handleClose}
                  style={{ paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border }}
                >
                  <Text style={{ fontFamily: fonts.heading, color: colors.inkFaint, fontSize: 15 }}>포기</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="mission-complete"
                  onPress={handleComplete}
                  style={{ flex: 1, paddingVertical: 16, borderRadius: 16, backgroundColor: colors.green, alignItems: 'center' }}
                >
                  <Text style={{ fontFamily: fonts.heading, color: '#fff', fontSize: 17 }}>완료했어요!</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text testID="mission-status" style={{ fontFamily: fonts.heading, fontSize: 16, color: colors.inkMuted, marginBottom: 16 }}>
                {task.status === 'COMPLETED' ? '완료됨' : '실패'}
              </Text>
              <TouchableOpacity
                testID="mission-close"
                onPress={handleClose}
                style={{ paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' }}
              >
                <Text style={{ fontFamily: fonts.heading, color: colors.inkFaint, fontSize: 15 }}>닫기</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
