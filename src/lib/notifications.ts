import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

// expo-notifications doesn't work in Expo Go (SDK 53+). All functions are no-ops there.
const isExpoGo = Constants.executionEnvironment === 'storeClient';

function getDeviceLang(): 'tr' | 'en' {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    return locale.startsWith('tr') ? 'tr' : 'en';
  } catch { return 'en'; }
}

const KEY_NOTIF_PROMPTED = '@pt:notif_prompted';

export async function shouldPromptForPermission(): Promise<boolean> {
  if (isExpoGo) return false;
  const prompted = await AsyncStorage.getItem(KEY_NOTIF_PROMPTED);
  if (prompted === 'true') return false;
  const Notifications = await import('expo-notifications');
  const { status } = await Notifications.getPermissionsAsync();
  return status !== 'granted';
}

export async function markPermissionPrompted(): Promise<void> {
  await AsyncStorage.setItem(KEY_NOTIF_PROMPTED, 'true');
}

async function setup() {
  if (isExpoGo) return;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}
setup();

export async function requestNotifPermissions(): Promise<boolean> {
  if (isExpoGo) return false;
  const Notifications = await import('expo-notifications');
  const { Platform } = await import('react-native');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'PuppyTrack',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function getNotifPermissionStatus(): Promise<boolean> {
  if (isExpoGo) return false;
  const Notifications = await import('expo-notifications');
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

async function cancelById(id: string) {
  if (isExpoGo) return;
  const Notifications = await import('expo-notifications');
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  if (scheduled.find(n => n.identifier === id)) {
    await Notifications.cancelScheduledNotificationAsync(id);
  }
}

const notifCopy = {
  tr: {
    feedingTitle: (name: string) => `${name} dışarı çıkmak istiyor! 🐾`,
    feedingWater:  (name: string, min: number) => `${name} ${min} dk önce su içti — tuvalet zamanı.`,
    feedingFood:   (name: string, min: number) => `${name} ${min} dk önce yedi — tuvalet zamanı.`,
    bathroomTitle: (name: string) => `${name} tuvalete gitmek istiyor! 🚨`,
    bathroomBody:  'Eğitim geçmişine göre tuvalet vakti geldi.',
    morningTitle:  'Günaydın! 🌅',
    morningBody:   (name: string) => `${name} için sabah tuvaleti zamanı.`,
    nightTitle:    'Gece kontrolü 🌙',
    nightBody:     (name: string) => `${name}'in yatmadan önceki son tuvaletini unutma.`,
    weeklyTitle:   'Haftalık rapor hazır 📊',
    weeklyBody:    (name: string) => `${name}'in bu haftaki eğitim ilerlemesine bak.`,
  },
  en: {
    feedingTitle: (name: string) => `Time to take ${name} outside! 🐾`,
    feedingWater:  (name: string, min: number) => `${name} had water ${min} min ago — bathroom break time.`,
    feedingFood:   (name: string, min: number) => `${name} had food ${min} min ago — bathroom break time.`,
    bathroomTitle: (name: string) => `${name} needs to go outside! 🚨`,
    bathroomBody:  "It's bathroom time based on your training history.",
    morningTitle:  'Good morning! 🌅',
    morningBody:   (name: string) => `Time to take ${name} outside for a morning bathroom break.`,
    nightTitle:    'Night check 🌙',
    nightBody:     (name: string) => `Don't forget ${name}'s last bathroom trip before bed.`,
    weeklyTitle:   'Weekly report ready 📊',
    weeklyBody:    (name: string) => `Check ${name}'s training progress for this week.`,
  },
};

export async function scheduleFeedingReminder(
  dogName: string,
  feedType: 'water' | 'food',
  offsetMinutes: number,
): Promise<void> {
  if (isExpoGo || offsetMinutes <= 0) return;
  const Notifications = await import('expo-notifications');
  const { SchedulableTriggerInputTypes } = Notifications;
  const c = notifCopy[getDeviceLang()];
  const id = `feeding-${feedType}`;
  await cancelById(id);
  await Notifications.scheduleNotificationAsync({
    identifier: id,
    content: {
      title: c.feedingTitle(dogName),
      body: feedType === 'water' ? c.feedingWater(dogName, offsetMinutes) : c.feedingFood(dogName, offsetMinutes),
      sound: true,
    },
    trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: offsetMinutes * 60, repeats: false },
  });
}

export async function scheduleBathroomAlert(dogName: string, remainingMinutes: number): Promise<void> {
  if (isExpoGo || remainingMinutes <= 1) return;
  const Notifications = await import('expo-notifications');
  const { SchedulableTriggerInputTypes } = Notifications;
  const c = notifCopy[getDeviceLang()];
  await cancelById('bathroom-pred');
  await Notifications.scheduleNotificationAsync({
    identifier: 'bathroom-pred',
    content: {
      title: c.bathroomTitle(dogName),
      body: c.bathroomBody,
      sound: true,
    },
    trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.round(remainingMinutes * 60), repeats: false },
  });
}

export async function setMorningReminder(dogName: string, enabled: boolean): Promise<void> {
  if (isExpoGo) return;
  const Notifications = await import('expo-notifications');
  const { SchedulableTriggerInputTypes } = Notifications;
  const c = notifCopy[getDeviceLang()];
  await cancelById('morning');
  if (!enabled) return;
  await Notifications.scheduleNotificationAsync({
    identifier: 'morning',
    content: { title: c.morningTitle, body: c.morningBody(dogName), sound: true },
    trigger: { type: SchedulableTriggerInputTypes.DAILY, hour: 7, minute: 0 },
  });
}

export async function setNightReminder(dogName: string, enabled: boolean): Promise<void> {
  if (isExpoGo) return;
  const Notifications = await import('expo-notifications');
  const { SchedulableTriggerInputTypes } = Notifications;
  const c = notifCopy[getDeviceLang()];
  await cancelById('night');
  if (!enabled) return;
  await Notifications.scheduleNotificationAsync({
    identifier: 'night',
    content: { title: c.nightTitle, body: c.nightBody(dogName), sound: true },
    trigger: { type: SchedulableTriggerInputTypes.DAILY, hour: 22, minute: 0 },
  });
}

export async function setWeeklyReminder(dogName: string, enabled: boolean): Promise<void> {
  if (isExpoGo) return;
  const Notifications = await import('expo-notifications');
  const { SchedulableTriggerInputTypes } = Notifications;
  const c = notifCopy[getDeviceLang()];
  await cancelById('weekly');
  if (!enabled) return;
  await Notifications.scheduleNotificationAsync({
    identifier: 'weekly',
    content: { title: c.weeklyTitle, body: c.weeklyBody(dogName), sound: true },
    trigger: { type: SchedulableTriggerInputTypes.WEEKLY, weekday: 2, hour: 9, minute: 0 },
  });
}
