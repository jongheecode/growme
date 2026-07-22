import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { isReminderEnabled, setReminderEnabled } from './notifications';

beforeEach(() => {
  jest.clearAllMocks();
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

  it('schedules a daily reminder and persists the flag when enabling', async () => {
    (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
    const ok = await setReminderEnabled(true);

    expect(ok).toBe(true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: expect.objectContaining({ hour: 20, minute: 0 }),
      })
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith('growme_reminder_enabled', 'true');
  });

  it('does not schedule or persist enabled when permission is denied', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    const ok = await setReminderEnabled(true);

    expect(ok).toBe(false);
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
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
