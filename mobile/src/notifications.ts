import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';

const REMINDER_ENABLED_KEY = 'growme_reminder_enabled';
const REMINDER_NOTIFICATION_ID_KEY = 'growme_reminder_notification_id';
const REMINDER_HOUR = 20;
const REMINDER_MINUTE = 0;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function isReminderEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(REMINDER_ENABLED_KEY)) === 'true';
}

export async function setReminderEnabled(enabled: boolean): Promise<boolean> {
  if (!enabled) {
    await cancelReminder();
    await SecureStore.setItemAsync(REMINDER_ENABLED_KEY, 'false');
    return true;
  }

  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    return false;
  }
  await SecureStore.setItemAsync(REMINDER_ENABLED_KEY, 'true');
  return true;
}

// 서버 푸시가 없어서(로컬 알림뿐) 앱이 열려 있을 때만 스케줄을 다시
// 계산할 수 있다 — 오늘 남은 미션이 있을 때만 오늘 20시 알림을
// 예약하고, 이미 다 끝냈으면(또는 20시가 지났으면) 그날은 스킵한다.
// 매번 refresh할 때 호출해서 완료 상태 변화를 반영한다.
export async function syncMissionReminder(hasPendingToday: boolean): Promise<void> {
  const enabled = await isReminderEnabled();
  if (!enabled) return;

  await cancelReminder();
  if (!hasPendingToday) return;

  const now = new Date();
  const target = new Date(now);
  target.setHours(REMINDER_HOUR, REMINDER_MINUTE, 0, 0);
  if (target.getTime() <= now.getTime()) return;

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '꾸미가 기다리고 있어요',
      body: '오늘의 미션을 아직 안 하셨네요. 잠깐 확인해볼까요?',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: target,
    },
  });
  await SecureStore.setItemAsync(REMINDER_NOTIFICATION_ID_KEY, id);
}

async function cancelReminder(): Promise<void> {
  const id = await SecureStore.getItemAsync(REMINDER_NOTIFICATION_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
    await SecureStore.deleteItemAsync(REMINDER_NOTIFICATION_ID_KEY);
  }
}
