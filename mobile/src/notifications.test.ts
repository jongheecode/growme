import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { isReminderEnabled, setReminderEnabled, syncMissionReminder } from './notifications';

function mockStore(values: Record<string, string | null>) {
  (SecureStore.getItemAsync as jest.Mock).mockImplementation((key: string) =>
    Promise.resolve(values[key] ?? null)
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe('notifications', () => {
  it('reports disabled when nothing is stored', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    expect(await isReminderEnabled()).toBe(false);
  });

  it('reports enabled when the stored flag is true', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('true');
    expect(await isReminderEnabled()).toBe(true);
  });

  it('requests permission and persists the flag when enabling, without scheduling yet', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const ok = await setReminderEnabled(true);

    expect(ok).toBe(true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('growme_reminder_enabled', 'true');
  });

  it('does not persist enabled when permission is denied', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const ok = await setReminderEnabled(true);

    expect(ok).toBe(false);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith('growme_reminder_enabled', 'true');
  });

  it('cancels the scheduled reminder and persists the flag when disabling', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('mock-notification-id');
    const ok = await setReminderEnabled(false);

    expect(ok).toBe(true);
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('mock-notification-id');
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('growme_reminder_enabled', 'false');
  });
});

describe('syncMissionReminder', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('does nothing when reminders are disabled', async () => {
    mockStore({ growme_reminder_enabled: 'false' });
    await syncMissionReminder(true);

    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('cancels any existing reminder and does not reschedule when there are no pending tasks today', async () => {
    mockStore({ growme_reminder_enabled: 'true', growme_reminder_notification_id: 'existing-id' });
    await syncMissionReminder(false);

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('existing-id');
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules a one-time reminder for today when tasks are pending and 20:00 has not passed', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 1, 10, 0, 0));
    mockStore({ growme_reminder_enabled: 'true' });

    await syncMissionReminder(true);

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ type: 'date' }),
      })
    );
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    const target = call.trigger.date as Date;
    expect(target.getHours()).toBe(20);
    expect(target.getMinutes()).toBe(0);
    expect(target.getDate()).toBe(1);
  });

  it('does not schedule when today\'s reminder time has already passed', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 0, 1, 21, 0, 0));
    mockStore({ growme_reminder_enabled: 'true' });

    await syncMissionReminder(true);

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
