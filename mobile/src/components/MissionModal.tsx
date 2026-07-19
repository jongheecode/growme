import { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { Task } from '../api/tasks';
import { startTaskSession, sendHeartbeat, endSession } from '../api/sessions';

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

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      <View testID="mission-modal" style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16, width: '80%' }}>
          <Text testID="mission-title">{task.title}</Text>
          <Text testID="mission-meta">{`${task.category} · ${task.difficulty} · +${task.xpValue}XP`}</Text>
          {task.status === 'PENDING' ? (
            <>
              <Text testID="mission-timer">{formatElapsed(elapsedSeconds)}</Text>
              {sessionId ? (
                <TouchableOpacity testID="mission-timer-stop" onPress={stopTimerIfRunning}>
                  <Text>타이머 중지</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity testID="mission-timer-start" onPress={handleStartTimer}>
                  <Text>타이머 시작</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity testID="mission-complete" onPress={handleComplete}>
                <Text>완료</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text testID="mission-status">{task.status === 'COMPLETED' ? '완료됨' : '실패'}</Text>
          )}
          <TouchableOpacity testID="mission-close" onPress={handleClose}>
            <Text>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
