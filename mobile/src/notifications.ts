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
  await scheduleReminder();
  await SecureStore.setItemAsync(REMINDER_ENABLED_KEY, 'true');
  return true;
}

async function scheduleReminder(): Promise<void> {
  await cancelReminder();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '꾸미가 기다리고 있어요',
      body: '오늘의 미션을 아직 안 하셨네요. 잠깐 확인해볼까요?',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
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
