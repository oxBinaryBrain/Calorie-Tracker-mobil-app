import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/** Title used by the daily reminder; also the cancel key for scheduled copies. */
export const REMINDER_TITLE = 'Caloria';
export const REMINDER_BODY = 'A minute to log what you ate today.';
/** Older title, cancelled on schedule so upgrades drop stale copies. */
const LEGACY_REMINDER_TITLE = 'A moment to note';

export async function ensureNotificationPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Logging reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4E9468',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

/** Schedule (or reschedule) the one daily "time to log" local reminder. */
export async function scheduleDailyReminder(hour: number, minute = 0): Promise<string | null> {
  try {
    await ensureAndroidChannel();
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: REMINDER_TITLE,
        body: REMINDER_BODY,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: 'reminders',
      },
    });
    return id ?? null;
  } catch {
    return null; // unsupported environment (e.g. Expo Go web) — stay silent
  }
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    for (const n of all) {
      const title = n.content.title;
      if (title === REMINDER_TITLE || title === LEGACY_REMINDER_TITLE) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier);
      }
    }
  } catch {
    // ignore
  }
}

// Present alerts while app is foregrounded so the reminder is not dropped.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});
